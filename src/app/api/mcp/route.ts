/**
 * MCP Server — Model Context Protocol (Streamable HTTP transport, 2025-03-26).
 * Exposes Runlabs42 workspace tools so Claude Code and other MCP clients
 * can read/write project files and trigger spec-kit generation.
 *
 * Connect from Claude Code:
 *   claude mcp add runlabs42 --transport http https://<host>/api/mcp \
 *     --header "Authorization: Bearer <api_key>"
 */
import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { z } from 'zod'
import { captureException } from '@/lib/observability/captureException'
import { requireUser } from '@/lib/auth/requireUser'
import { ApiError } from '@/lib/api/errors'
import { isSpecWorkspacePath } from '@/lib/projects/specPaths'

const MCP_PROTOCOL_VERSION = '2025-03-26'
const SERVER_NAME = 'runlabs42'
const SERVER_VERSION = '1.0.0'

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'list_project_files',
    description: 'List all files in a Runlabs42 project workspace, including spec artifacts.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project UUID' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'read_project_file',
    description: 'Read the content of a specific file from a Runlabs42 project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project UUID' },
        path: { type: 'string', description: 'File path relative to project root, e.g. src/App.tsx' },
      },
      required: ['project_id', 'path'],
    },
  },
  {
    name: 'write_project_file',
    description: 'Create or update a file in a Runlabs42 project. Spec files (spec/*.md) can be updated to guide code generation.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project UUID' },
        path: { type: 'string', description: 'File path, e.g. src/components/Hero.tsx or spec/spec.md' },
        content: { type: 'string', description: 'Full file content to write' },
      },
      required: ['project_id', 'path', 'content'],
    },
  },
  {
    name: 'get_spec_artifacts',
    description: 'Get all spec-kit planning artifacts (constitution, spec, plan, tasks) for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project UUID' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'list_projects',
    description: 'List all projects belonging to the authenticated user.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20, max 50)' },
      },
    },
  },
  {
    name: 'export_design_mockups',
    description:
      'List design mockup paths (PNG in design/mockups/ and spec/design.json) for MCP/Figma file exchange.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project UUID' },
      },
      required: ['project_id'],
    },
  },
] as const

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────

function rpcOk(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result }, { status: 200 })
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } }, { status: 200 })
}

// ─── Input validation ─────────────────────────────────────────────────────────

const rpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string(),
  params: z.unknown().optional(),
})

const pathSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[a-zA-Z0-9_\-/.]+$/, 'Invalid path characters')
  .refine((p) => !p.includes('..'), 'Path traversal not allowed')

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
    },
  })
}


/** Resolve auth from session cookie OR Bearer token (for MCP clients like Claude Code). */
async function resolveMcpUser(request: Request) {
  // Prefer Bearer token so headless MCP clients can authenticate without cookies.
  const authHeader = request.headers.get('Authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (!token) throw new ApiError(401, 'Invalid Bearer token')

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) throw new ApiError(401, 'Supabase not configured')

    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const supabase = createSupabaseClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw new ApiError(401, 'Invalid or expired token')
    return { supabase, user }
  }

  // Fallback: session cookie (web UI)
  return requireUser()
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await resolveMcpUser(request)

    const raw = await request.json()
    const parsed = rpcRequestSchema.safeParse(raw)
    if (!parsed.success) {
      return rpcError(null, -32600, 'Invalid Request')
    }

    const { id = null, method, params } = parsed.data
    const args = (params ?? {}) as Record<string, unknown>

    // ── initialize ────────────────────────────────────────────────────────────
    if (method === 'initialize') {
      return rpcOk(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: {},
        },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      })
    }

    // ── tools/list ────────────────────────────────────────────────────────────
    if (method === 'tools/list') {
      return rpcOk(id, { tools: TOOLS })
    }

    // ── tools/call ────────────────────────────────────────────────────────────
    if (method === 'tools/call') {
      const toolName = String(args.name ?? '')
      const toolArgs = (args.arguments ?? {}) as Record<string, unknown>

      try {
        const content = await callTool(toolName, toolArgs, user.id, supabase)
        return rpcOk(id, { content: [{ type: 'text', text: content }] })
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Tool execution failed'
        return rpcOk(id, {
          content: [{ type: 'text', text: `Error: ${msg}` }],
          isError: true,
        })
      }
    }

    // ── ping ─────────────────────────────────────────────────────────────────
    if (method === 'ping') {
      return rpcOk(id, {})
    }

    return rpcError(id, -32601, `Method not found: ${method}`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await captureException(e)
    return rpcError(null, -32603, 'Internal error')
  }
}

// ─── Tool implementations ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callTool(name: string, args: Record<string, unknown>, userId: string, supabase: any): Promise<string> {
  switch (name) {
    case 'list_projects': {
      const limit = Math.min(Number(args.limit ?? 20), 50)
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, framework, status, updated_at, deployed_url')
        .eq('user_id', userId)
        .neq('status', 'deleted')
        .order('updated_at', { ascending: false })
        .limit(limit)
      if (error) throw new ApiError(500, error.message)
      return JSON.stringify(data ?? [], null, 2)
    }

    case 'list_project_files': {
      const projectId = String(args.project_id ?? '')
      await assertProjectAccess(supabase, projectId, userId)

      const { data, error } = await supabase
        .from('project_files')
        .select('path, updated_at')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .order('path')
      if (error) throw new ApiError(500, error.message)
      const paths = (data ?? []).map((r: { path: string }) => r.path)
      return JSON.stringify(paths, null, 2)
    }

    case 'read_project_file': {
      const projectId = String(args.project_id ?? '')
      const rawPath = String(args.path ?? '')
      const path = pathSchema.parse(rawPath)
      await assertProjectAccess(supabase, projectId, userId)

      const { data, error } = await supabase
        .from('project_files')
        .select('content')
        .eq('project_id', projectId)
        .eq('path', path)
        .eq('user_id', userId)
        .single()
      if (error || !data) throw new ApiError(404, `File not found: ${path}`)
      return String(data.content ?? '')
    }

    case 'write_project_file': {
      const projectId = String(args.project_id ?? '')
      const rawPath = String(args.path ?? '')
      const path = pathSchema.parse(rawPath)
      const content = String(args.content ?? '')

      if (content.length > 500_000) throw new ApiError(400, 'File content too large (max 500 KB)')
      await assertProjectAccess(supabase, projectId, userId)

      const { error } = await supabase.from('project_files').upsert(
        {
          project_id: projectId,
          user_id: userId,
          path,
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id,path' },
      )
      if (error) throw new ApiError(500, `Write failed: ${error.message}`)
      return JSON.stringify({ ok: true, path, bytesWritten: content.length })
    }

    case 'get_spec_artifacts': {
      const projectId = String(args.project_id ?? '')
      await assertProjectAccess(supabase, projectId, userId)

      const { data, error } = await supabase
        .from('project_files')
        .select('path, content')
        .eq('project_id', projectId)
        .eq('user_id', userId)
      if (error) throw new ApiError(500, error.message)

      const files: { path: string; content: string }[] = data ?? []
      const specs = files.filter((f) => isSpecWorkspacePath(f.path))
      const byPath = Object.fromEntries(specs.map((f) => [f.path, f.content]))

      return JSON.stringify(
        {
          constitution: byPath['spec/constitution.md'] ?? null,
          spec: byPath['spec/spec.md'] ?? null,
          plan: byPath['spec/plan.md'] ?? null,
          tasks: byPath['spec/tasks.md'] ?? null,
        },
        null,
        2,
      )
    }

    case 'export_design_mockups': {
      const projectId = String(args.project_id ?? '')
      await assertProjectAccess(supabase, projectId, userId)

      const { data, error } = await supabase
        .from('project_files')
        .select('path, updated_at')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .order('path')
      if (error) throw new ApiError(500, error.message)

      const paths = (data ?? []).map((r: { path: string }) => r.path)
      const mockups = paths.filter((p: string) => /^design\/mockups\/[^/]+\.png$/.test(p))
      const hasSpec = paths.includes('spec/design.json')
      const hasMd = paths.includes('spec/design.md')

      return JSON.stringify(
        {
          spec: hasSpec ? 'spec/design.json' : null,
          designDoc: hasMd ? 'spec/design.md' : null,
          mockups,
          hint: 'Use read_project_file for spec/design.json; PNG files are base64 in storage. Figma exchange via Figma MCP server.',
        },
        null,
        2,
      )
    }

    default:
      throw new ApiError(400, `Unknown tool: ${name}`)
  }
}

async function assertProjectAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  userId: string,
): Promise<void> {
  if (!projectId) throw new ApiError(400, 'project_id is required')
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .neq('status', 'deleted')
    .single()
  if (!data) throw new ApiError(403, 'Project not found or access denied')
}
