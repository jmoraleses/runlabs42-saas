import { apiFetch } from '@/lib/api/client'

export async function completeOnboarding(currentSettings: Record<string, unknown>): Promise<void> {
  await apiFetch('/api/user/profile', {
    method: 'PATCH',
    body: JSON.stringify({
      settings: {
        ...currentSettings,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      },
    }),
  })
}
