'use client'

import React, { useState, useMemo } from 'react'
import { useApp } from '@/components/app/shell'

type McpEntry = {
  id: string
  name: string
  color: string
  icon: string
  href: string
  desc: Record<string, string>
}

type McpCategory = {
  id: string
  label: Record<string, string>
  items: McpEntry[]
}

const CATALOG: McpCategory[] = [
  {
    id: 'comms',
    label: { en: 'Communication', es: 'Comunicación', fr: 'Communication', de: 'Kommunikation', nl: 'Communicatie', it: 'Comunicazione' },
    items: [
      {
        id: 'slack', name: 'Slack', color: '#4a154b',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
        desc: { en: 'Team messaging and channels', es: 'Mensajes y canales de equipo', fr: 'Messagerie et canaux d\'équipe', de: 'Team-Messaging und Kanäle', nl: 'Teamberichten en kanalen', it: 'Messaggi e canali del team' },
        icon: 'M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z',
      },
      {
        id: 'gmail', name: 'Gmail', color: '#ea4335',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gmail',
        desc: { en: 'Read and send emails', es: 'Leer y enviar correos', fr: 'Lire et envoyer des e-mails', de: 'E-Mails lesen und senden', nl: 'E-mails lezen en verzenden', it: 'Leggi e invia email' },
        icon: 'M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.910 1.528-1.145C21.69 2.28 24 3.434 24 5.457z',
      },
      {
        id: 'gcal', name: 'Google Calendar', color: '#4285f4',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-calendar',
        desc: { en: 'Schedule and manage events', es: 'Agenda y gestiona eventos', fr: 'Planifier et gérer des événements', de: 'Termine planen und verwalten', nl: 'Afspraken plannen en beheren', it: 'Pianifica e gestisci eventi' },
        icon: 'M18.316 5.684H24v12.632h-5.684v-2.842h-1.895v2.842H7.58V5.684h9.842v2.842h1.895V5.684zM7.58 21.474H5.685v-1.895H3.79v1.895H1.895V3.79H3.79V1.894h1.895V3.79H7.58v1.894H5.685v13.895H7.58v1.895zM22.105 16.42v-8.84h-3.789v8.84h3.789z',
      },
      {
        id: 'teams', name: 'Microsoft Teams', color: '#6264a7',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/teams',
        desc: { en: 'Meetings and team collaboration', es: 'Reuniones y colaboración', fr: 'Réunions et collaboration', de: 'Meetings und Zusammenarbeit', nl: 'Vergaderingen en samenwerking', it: 'Riunioni e collaborazione' },
        icon: 'M20.625 7.219a2.625 2.625 0 1 0 0-5.25 2.625 2.625 0 0 0 0 5.25zM14.25 8.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6.375 0c.614 0 1.196-.112 1.73-.315A3.742 3.742 0 0 1 24 11.625v.375h-3.75v-.375a6.74 6.74 0 0 0-.496-2.552c.288-.545.871-.823 1.871-.823zM14.25 9.75c-1.18 0-2.287.29-3.255.8A6.76 6.76 0 0 0 7.5 11.625v.375h13.5v-.375A6.75 6.75 0 0 0 14.25 9.75zm-6.75 6v6.75A1.5 1.5 0 0 1 6 24H1.5A1.5 1.5 0 0 1 0 22.5V15.75A1.5 1.5 0 0 1 1.5 14.25H6A1.5 1.5 0 0 1 7.5 15.75z',
      },
    ],
  },
  {
    id: 'productivity',
    label: { en: 'Productivity', es: 'Productividad', fr: 'Productivité', de: 'Produktivität', nl: 'Productiviteit', it: 'Produttività' },
    items: [
      {
        id: 'notion', name: 'Notion', color: '#191919',
        href: 'https://github.com/makenotion/notion-mcp-server',
        desc: { en: 'Notes, docs and databases', es: 'Notas, docs y bases de datos', fr: 'Notes, docs et bases de données', de: 'Notizen, Docs und Datenbanken', nl: 'Notities, docs en databases', it: 'Note, documenti e database' },
        icon: 'M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933z',
      },
      {
        id: 'linear', name: 'Linear', color: '#5e6ad2',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/linear',
        desc: { en: 'Issues and project tracking', es: 'Issues y seguimiento de proyectos', fr: 'Issues et suivi de projets', de: 'Issues und Projektverfolgung', nl: 'Issues en projectopvolging', it: 'Issues e tracking del progetto' },
        icon: 'M0 14.008 9.993 24 24 10.005 13.997 0 0 14.008zm.996-.425 5.37 5.37L14.565.804.996 13.583zm6.14 6.135 7.865 7.864 8.185-8.184-7.863-7.864-8.187 8.184z',
      },
      {
        id: 'jira', name: 'Jira', color: '#0052cc',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/jira',
        desc: { en: 'Bug and issue management', es: 'Gestión de bugs e issues', fr: 'Gestion des bugs et issues', de: 'Bug- und Issue-Verwaltung', nl: 'Bug- en issuebeheer', it: 'Gestione bug e issue' },
        icon: 'M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.004-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.762a1.005 1.005 0 0 0-1.001-1.005zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24.016 12.49V1.004A1.001 1.001 0 0 0 23.013 0z',
      },
      {
        id: 'asana', name: 'Asana', color: '#f06a6a',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/asana',
        desc: { en: 'Tasks and project management', es: 'Tareas y gestión de proyectos', fr: 'Tâches et gestion de projets', de: 'Aufgaben und Projektmanagement', nl: 'Taken en projectbeheer', it: 'Attività e gestione progetti' },
        icon: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 6.75a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5zm-5.625 7.5a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5zm11.25 0a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5z',
      },
      {
        id: 'hubspot', name: 'HubSpot', color: '#ff7a59',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/hubspot',
        desc: { en: 'CRM, contacts and deals', es: 'CRM, contactos y ventas', fr: 'CRM, contacts et affaires', de: 'CRM, Kontakte und Deals', nl: 'CRM, contacten en deals', it: 'CRM, contatti e trattative' },
        icon: 'M17.26 8.279V5.542a1.74 1.74 0 0 0 1.006-1.569V3.91a1.742 1.742 0 0 0-1.742-1.742h-.063a1.742 1.742 0 0 0-1.742 1.742v.063a1.74 1.74 0 0 0 1.006 1.569v2.737a4.948 4.948 0 0 0-2.355 1.032L6.7 4.496a1.95 1.95 0 1 0-.881 1.18l6.484 4.627a4.952 4.952 0 0 0-.776 2.644 4.971 4.971 0 0 0 .914 2.86l-1.973 1.973a1.637 1.637 0 1 0 .993.993l2.02-2.02a4.962 4.962 0 0 0 2.78.844 4.984 4.984 0 0 0 .999-9.518z',
      },
    ],
  },
  {
    id: 'dev',
    label: { en: 'Code & Dev', es: 'Código y Desarrollo', fr: 'Code et Développement', de: 'Code & Entwicklung', nl: 'Code & Ontwikkeling', it: 'Codice e Sviluppo' },
    items: [
      {
        id: 'github', name: 'GitHub', color: '#24292e',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
        desc: { en: 'Repos, PRs and issues', es: 'Repos, PRs e issues', fr: 'Dépôts, PRs et issues', de: 'Repos, PRs und Issues', nl: 'Repos, PR\'s en issues', it: 'Repo, PR e issue' },
        icon: 'M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z',
      },
      {
        id: 'gitlab', name: 'GitLab', color: '#fc6d26',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab',
        desc: { en: 'Git hosting and CI/CD', es: 'Hosting git y CI/CD', fr: 'Hébergement git et CI/CD', de: 'Git-Hosting und CI/CD', nl: 'Git-hosting en CI/CD', it: 'Hosting git e CI/CD' },
        icon: 'M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.386 9.45.044 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.625-8.443a.924.924 0 0 0 .33-1.024',
      },
      {
        id: 'vercel', name: 'Vercel', color: '#000000',
        href: 'https://github.com/vercel/mcp',
        desc: { en: 'Deploy and manage projects', es: 'Desplegar y gestionar proyectos', fr: 'Déployer et gérer des projets', de: 'Projekte deployen und verwalten', nl: 'Projecten deployen en beheren', it: 'Deploy e gestione progetti' },
        icon: 'M24 22.525H0l12-21.05 12 21.05z',
      },
      {
        id: 'supabase', name: 'Supabase', color: '#3ecf8e',
        href: 'https://github.com/supabase-community/supabase-mcp',
        desc: { en: 'Database, auth and storage', es: 'Base de datos, auth y storage', fr: 'Base de données, auth et stockage', de: 'Datenbank, Auth und Storage', nl: 'Database, auth en opslag', it: 'Database, auth e storage' },
        icon: 'M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C.152 12.888.754 14.064 1.8 14.064h9.116l.139 8.9c.015.986 1.26 1.41 1.874.637l9.262-11.652c.612-.838.01-2.014-1.036-2.014h-9.116L11.9 1.036z',
      },
      {
        id: 'cloudflare', name: 'Cloudflare', color: '#f38020',
        href: 'https://github.com/cloudflare/mcp-server-cloudflare',
        desc: { en: 'Workers, KV and edge config', es: 'Workers, KV y config edge', fr: 'Workers, KV et config edge', de: 'Workers, KV und Edge-Config', nl: 'Workers, KV en edge-config', it: 'Workers, KV e config edge' },
        icon: 'M16.535 16.902c.085-.298.064-.572-.08-.783-.129-.19-.346-.31-.6-.33l-8.54-.108c-.064 0-.118-.032-.15-.085a.193.193 0 0 1-.01-.171c.031-.075.106-.128.19-.128l8.604-.107c1.02-.053 2.124-.884 2.51-1.895l.49-1.282a.243.243 0 0 0 .01-.148C18.544 8.8 15.9 6.5 12.686 6.5c-2.968 0-5.49 1.915-6.4 4.58a2.912 2.912 0 0 0-1.972-.564c-1.43.138-2.575 1.3-2.703 2.73-.032.33-.01.65.053.948C.687 14.268 0 15.21 0 16.32c0 .096.01.192.021.298.01.074.075.127.15.127h16.055a.2.2 0 0 0 .19-.138l.119-.705zM19.235 12.073a.613.613 0 0 0-.107.01c-.054 0-.086.032-.107.085l-.4 1.388c-.085.298-.064.572.08.783.129.19.346.31.6.33l1.89.107c.064 0 .118.032.15.085a.193.193 0 0 1 .01.171c-.031.075-.106.128-.19.128l-1.953.108c-1.03.053-2.124.884-2.51 1.895l-.128.33a.09.09 0 0 0 .085.117h6.187a.174.174 0 0 0 .17-.128c.234-.87.352-1.782.352-2.718-.01-1.399-.31-2.73-.862-3.922a.11.11 0 0 0-.086-.053 3.785 3.785 0 0 0-3.18 1.283z',
      },
      {
        id: 'stripe', name: 'Stripe', color: '#635bff',
        href: 'https://github.com/stripe/agent-toolkit',
        desc: { en: 'Payments, customers and billing', es: 'Pagos, clientes y facturación', fr: 'Paiements, clients et facturation', de: 'Zahlungen, Kunden und Abrechnung', nl: 'Betalingen, klanten en facturering', it: 'Pagamenti, clienti e fatturazione' },
        icon: 'M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z',
      },
    ],
  },
  {
    id: 'data',
    label: { en: 'Data & Storage', es: 'Datos y Almacenamiento', fr: 'Données et Stockage', de: 'Daten & Speicher', nl: 'Data & Opslag', it: 'Dati e Archiviazione' },
    items: [
      {
        id: 'postgres', name: 'PostgreSQL', color: '#336791',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
        desc: { en: 'Query relational databases', es: 'Consultar bases de datos relacionales', fr: 'Requêtes sur bases relationnelles', de: 'Relationale Datenbanken abfragen', nl: 'Relationele databases bevragen', it: 'Interroga database relazionali' },
        icon: 'M17.128 0a10.134 10.134 0 0 0-2.755.403l-.063.02C13.616.053 12.955 0 12.27 0 9.075 0 6.748 1.266 5.362 3.213c-.9.17-1.775.45-2.561.833C.992 5.025.004 6.989 0 8.842c-.005 2.39 1.01 4.385 2.733 5.248a4.57 4.57 0 0 0 .433.184c-.003.04-.006.077-.006.117 0 1.366.484 2.647 1.336 3.605C4.49 17.998 4.444 18 4.4 18h.003c.022 0 .043 0 .066-.003 1.625-.031 3.08-.706 4.23-1.845.386.04.78.06 1.18.06h.002c.748 0 1.49-.07 2.22-.207.95.905 2.19 1.48 3.598 1.48.27 0 .544-.018.817-.056.555.43 1.244.63 1.957.63.89 0 1.792-.3 2.52-.895.753-.613 1.247-1.49 1.384-2.51.284-.194.556-.41.81-.646C23.752 12.726 24 10.95 24 9.47c0-5.15-3.143-9.12-6.872-9.47zM12.27 1.405c.492 0 .966.03 1.42.083-.257.19-.504.395-.74.618-.83.776-1.532 1.742-2.025 2.855l-.127.297-.265-.195a2.88 2.88 0 0 0-.424-.264 12.62 12.62 0 0 0-1.033-.454 6.65 6.65 0 0 1 3.194-2.94zm1.963 11.63a7.9 7.9 0 0 1-2.04.267h-.003c-.478 0-.95-.04-1.405-.12l-.403-.07-.226.34c-.4.604-.879 1.09-1.41 1.438l.12-.35c.178-.52.245-1.07.205-1.593l-.05-.656-.633-.147a3.635 3.635 0 0 1-.667-.223c-1.253-.6-1.985-2.13-1.98-4.006.003-1.537.684-3.016 1.853-3.87.194-.14.4-.26.617-.36l.264.194c.523.383 1.19.578 1.975.578.854 0 1.842-.233 2.944-.695.204.293.399.613.574.96.707 1.42 1.066 3.13 1.014 4.924a7.95 7.95 0 0 1-.749 3.109z',
      },
      {
        id: 'sqlite', name: 'SQLite', color: '#003b57',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
        desc: { en: 'Local SQL database files', es: 'Archivos de base de datos SQL local', fr: 'Fichiers de base de données SQL locale', de: 'Lokale SQL-Datenbankdateien', nl: 'Lokale SQL-databasebestanden', it: 'File database SQL locale' },
        icon: 'M21.678.521C20.341-.04 19.037.012 18.037.638l-.05.038c-.866.616-1.275 1.629-1.387 2.641-.246 2.141.672 4.474 2.16 5.956.546.537 1.268 1.076 1.978 1.076.18 0 .36-.03.534-.095 1.015-.37 1.625-1.572 1.692-3.243.077-1.992-.58-4.17-1.286-6.49zM17.506 9.695c-.755-.743-1.494-1.842-1.977-2.988-.448-1.071-.634-2.145-.54-3.105.057-.581.25-1.227.678-1.71L7.57 9.935l3.456 3.456 6.48-3.696zm-7.74 4.45L6.31 10.69.625 20.557c-.405.7-.334 1.581.182 2.193.32.377.77.588 1.24.588.28 0 .56-.072.82-.218l9.868-5.685-3.07-3.29z',
      },
      {
        id: 'gdrive', name: 'Google Drive', color: '#4285f4',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive',
        desc: { en: 'Files, docs and spreadsheets', es: 'Archivos, docs y hojas de cálculo', fr: 'Fichiers, docs et tableurs', de: 'Dateien, Docs und Tabellen', nl: 'Bestanden, docs en spreadsheets', it: 'File, documenti e fogli di calcolo' },
        icon: 'M6.28 0l6.281 10.876-6.28 10.876H0L6.28 0zm11.437 0L24 10.876l-6.283 10.876H11.44L17.717 0zM12 14.668L8.86 21.752H15.14L12 14.668z',
      },
      {
        id: 'airtable', name: 'Airtable', color: '#18bfff',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/airtable',
        desc: { en: 'Structured data and bases', es: 'Datos estructurados y bases', fr: 'Données structurées et bases', de: 'Strukturierte Daten und Bases', nl: 'Gestructureerde data en bases', it: 'Dati strutturati e basi' },
        icon: 'M12.186 0L0 4.953v2.11l12.186 4.955 11.625-4.955v-2.11L12.186 0zM0 9.272v2.11l11.625 4.955V14.23L0 9.272zm12.75 7.843v-2.108l11.25-4.513v2.109l-11.25 4.512z',
      },
    ],
  },
  {
    id: 'design',
    label: { en: 'Design', es: 'Diseño', fr: 'Design', de: 'Design', nl: 'Design', it: 'Design' },
    items: [
      {
        id: 'figma', name: 'Figma', color: '#f24e1e',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/figma',
        desc: { en: 'Design files and components', es: 'Archivos de diseño y componentes', fr: 'Fichiers de design et composants', de: 'Design-Dateien und Komponenten', nl: 'Ontwerpbestanden en componenten', it: 'File di design e componenti' },
        icon: 'M5 19a5 5 0 0 0 5 5 5 5 0 0 0 5-5v-5H5v5zm5-19a5 5 0 0 0-5 5 5 5 0 0 0 5 5h5V5a5 5 0 0 0-5-5zm10 5a5 5 0 0 0-5-5 5 5 0 0 0 0 10 5 5 0 0 0 5-5zM5 10a5 5 0 0 0-5 5 5 5 0 0 0 5 5h5v-5a5 5 0 0 0-5-5zm10 5a5 5 0 0 0 5 5 5 5 0 0 0 5-5 5 5 0 0 0-5-5h-5v5z',
      },
      {
        id: 'canva', name: 'Canva', color: '#00c4cc',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/canva',
        desc: { en: 'Graphics and templates', es: 'Gráficos y plantillas', fr: 'Graphiques et modèles', de: 'Grafiken und Vorlagen', nl: 'Afbeeldingen en sjablonen', it: 'Grafiche e modelli' },
        icon: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4a9.6 9.6 0 1 1 0 19.2A9.6 9.6 0 0 1 12 2.4zm2.7 5.4c-1.08 0-2.04.576-2.7 1.44-.66-.864-1.62-1.44-2.7-1.44C7.434 7.8 6 9.48 6 11.52c0 1.44.66 2.736 1.68 3.576L12 18l4.32-2.904C17.34 14.256 18 12.96 18 11.52c0-2.04-1.434-3.72-3.3-3.72z',
      },
    ],
  },
  {
    id: 'search',
    label: { en: 'Search & Web', es: 'Búsqueda y Web', fr: 'Recherche et Web', de: 'Suche & Web', nl: 'Zoeken & Web', it: 'Ricerca e Web' },
    items: [
      {
        id: 'brave-search', name: 'Brave Search', color: '#f04d22',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
        desc: { en: 'Private web search', es: 'Búsqueda web privada', fr: 'Recherche web privée', de: 'Private Web-Suche', nl: 'Privé webzoekopdracht', it: 'Ricerca web privata' },
        icon: 'M15.6 2.4C15 1.2 13.8 0 12 0S9 1.2 8.4 2.4L0 18l2.4 2.4h19.2L24 18l-8.4-15.6zM12 6l3.6 6h-7.2L12 6z',
      },
      {
        id: 'fetch', name: 'Fetch', color: '#0070f3',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
        desc: { en: 'Fetch URLs and web content', es: 'Obtener URLs y contenido web', fr: 'Récupérer des URLs et contenus web', de: 'URLs und Web-Inhalte abrufen', nl: 'URLs en webinhoud ophalen', it: 'Recupera URL e contenuti web' },
        icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z',
      },
      {
        id: 'puppeteer', name: 'Puppeteer', color: '#40b5a4',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
        desc: { en: 'Browser automation and scraping', es: 'Automatización y scraping web', fr: 'Automatisation et scraping web', de: 'Browser-Automatisierung und Scraping', nl: 'Browser automatisering en scraping', it: 'Automazione e scraping browser' },
        icon: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2zm0 3a7 7 0 1 0 0 14A7 7 0 0 0 12 5zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 12 7zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
      },
      {
        id: 'gmaps', name: 'Google Maps', color: '#4285f4',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps',
        desc: { en: 'Places, routes and geocoding', es: 'Lugares, rutas y geocoding', fr: 'Lieux, itinéraires et géocodage', de: 'Orte, Routen und Geocoding', nl: 'Plaatsen, routes en geocoding', it: 'Luoghi, percorsi e geocodifica' },
        icon: 'M12 0C7.802 0 4 3.403 4 7.602 4 11.8 7.469 16.812 12 24c4.531-7.188 8-12.2 8-16.398C20 3.403 16.199 0 12 0zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
      },
    ],
  },
  {
    id: 'infra',
    label: { en: 'Infrastructure', es: 'Infraestructura', fr: 'Infrastructure', de: 'Infrastruktur', nl: 'Infrastructuur', it: 'Infrastruttura' },
    items: [
      {
        id: 'aws', name: 'AWS', color: '#ff9900',
        href: 'https://github.com/awslabs/mcp',
        desc: { en: 'Amazon cloud services', es: 'Servicios cloud de Amazon', fr: 'Services cloud Amazon', de: 'Amazon-Cloud-Dienste', nl: 'Amazon cloudservices', it: 'Servizi cloud Amazon' },
        icon: 'M7.17 10.4c0 .27.03.49.08.64.06.16.13.33.23.51.04.06.05.12.05.17 0 .08-.05.16-.14.24l-.47.31a.36.36 0 0 1-.19.06c-.07 0-.15-.04-.22-.1a2.3 2.3 0 0 1-.27-.35 5.76 5.76 0 0 1-.23-.44c-.58.68-1.3 1.02-2.18 1.02-.62 0-1.12-.18-1.48-.53-.36-.35-.54-.82-.54-1.4 0-.62.22-1.12.66-1.5.44-.38 1.02-.57 1.76-.57.24 0 .5.02.77.06.27.04.55.1.84.17v-.53c0-.55-.11-.94-.34-1.16-.23-.23-.62-.34-1.18-.34-.25 0-.52.03-.79.09-.27.06-.53.14-.79.24-.12.05-.2.08-.25.09-.05.01-.09.02-.12.02-.1 0-.16-.08-.16-.22v-.35c0-.12.01-.2.05-.25.04-.05.11-.1.21-.15.25-.13.55-.24.9-.33A4.3 4.3 0 0 1 4.3 6.4c.81 0 1.4.18 1.78.55.37.37.56.93.56 1.69v2.22h.53zm-3.01 1.13c.23 0 .47-.04.72-.13.25-.09.47-.25.66-.47.11-.13.19-.28.24-.45.04-.17.07-.37.07-.61v-.29a6.1 6.1 0 0 0-.67-.06 6.1 6.1 0 0 0-.65-.02c-.46 0-.8.09-1.02.28-.23.19-.34.46-.34.81 0 .33.08.58.26.74.17.17.42.2.73.2zm5.48.74c-.13 0-.22-.02-.28-.07-.06-.04-.11-.13-.16-.26L7.4 8.12a1.3 1.3 0 0 1-.07-.28c0-.11.06-.17.17-.17h.7c.14 0 .23.02.28.07.06.04.1.13.15.26l1.24 4.9 1.15-4.9c.04-.13.08-.22.14-.26.06-.04.16-.07.29-.07h.57c.14 0 .23.02.29.07.06.04.11.13.14.26l1.17 4.96 1.28-4.96c.04-.13.09-.22.15-.26.06-.04.15-.07.28-.07h.66c.11 0 .17.05.17.17 0 .04 0 .07-.01.11-.01.04-.03.1-.06.18l-1.83 5.82c-.04.13-.09.22-.15.26-.06.04-.15.07-.27.07h-.62c-.14 0-.23-.02-.29-.07-.06-.04-.11-.14-.14-.27l-1.15-4.8-1.14 4.79c-.04.13-.08.23-.14.27-.06.04-.16.07-.29.07h-.62zm9.7.17c-.38 0-.76-.04-1.12-.13-.37-.09-.65-.19-.85-.3-.12-.06-.2-.13-.23-.2a.5.5 0 0 1-.04-.2v-.36c0-.15.06-.22.17-.22.04 0 .08.01.12.02.04.02.1.04.17.07.23.1.48.19.75.24.27.05.54.08.81.08.43 0 .76-.07.99-.22.23-.15.35-.37.35-.66 0-.19-.06-.35-.18-.49-.12-.13-.35-.25-.68-.36l-.97-.3c-.49-.15-.85-.37-1.08-.67a1.59 1.59 0 0 1-.34-1c0-.28.06-.54.19-.76.13-.22.3-.41.51-.56.21-.16.45-.27.73-.35.28-.08.57-.12.88-.12.15 0 .31.01.46.03.16.02.3.05.44.08.13.04.26.07.37.12.12.04.21.09.27.13.09.06.15.12.19.19.04.07.06.15.06.26v.34c0 .15-.06.22-.17.22-.06 0-.16-.03-.28-.09a3.4 3.4 0 0 0-1.42-.29c-.39 0-.7.06-.91.19-.21.13-.32.33-.32.6 0 .2.07.36.2.5.14.13.38.26.74.37l.95.3c.48.15.83.36 1.04.63.21.27.32.58.32.93 0 .29-.06.55-.18.78-.12.23-.29.43-.5.59-.22.17-.47.29-.77.38-.3.09-.62.14-.96.14zM21.63 16.5c-2.62 1.94-6.43 2.97-9.71 2.97-4.59 0-8.73-1.7-11.86-4.52-.25-.22-.03-.53.27-.35 3.38 1.96 7.55 3.15 11.87 3.15 2.91 0 6.11-.6 9.06-1.86.44-.19.81.29.37.61z',
      },
      {
        id: 'sentry', name: 'Sentry', color: '#362d59',
        href: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sentry',
        desc: { en: 'Error monitoring and tracking', es: 'Monitoreo y seguimiento de errores', fr: 'Surveillance et suivi des erreurs', de: 'Fehlerüberwachung und Tracking', nl: 'Foutbewaking en tracking', it: 'Monitoraggio e tracking errori' },
        icon: 'M14.707 2.268l-1.163-2.008a.463.463 0 0 0-.402-.233.447.447 0 0 0-.39.233l-1.164 2.008c-2.443 4.214-1.32 9.698.849 13.49H8.9a13.55 13.55 0 0 1-.925-2.488H5.7a15.985 15.985 0 0 0 1.48 4.002.46.46 0 0 0 .403.233h3.49c.155 0 .31-.08.401-.233l.009-.015c3.24-5.59 2.327-11.736-2.29-15.238a12.64 12.64 0 0 1 4.63 0c-2.443 4.214-1.32 9.698.849 13.49h-2.023a.457.457 0 0 0-.402.233l-1.163 2.008a.457.457 0 0 0 0 .465c.079.15.232.233.402.233h14.12a.46.46 0 0 0 .403-.697l-1.163-2.008a.46.46 0 0 0-.402-.234H21.21c2.169-3.792 3.292-9.276.849-13.49z',
      },
    ],
  },
]

const SEARCH_PLACEHOLDER: Record<string, string> = {
  en: 'Search connectors…',
  es: 'Buscar conectores…',
  fr: 'Rechercher des connecteurs…',
  de: 'Konnektoren suchen…',
  nl: 'Connectoren zoeken…',
  it: 'Cerca connettori…',
}

const CAT_LABEL_ALL: Record<string, string> = {
  en: 'All', es: 'Todos', fr: 'Tous', de: 'Alle', nl: 'Alle', it: 'Tutti',
}

export function McpCatalog() {
  const { lang } = useApp() as { lang: string }
  const l = lang in SEARCH_PLACEHOLDER ? lang : 'en'

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return CATALOG.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => {
        const matchesCat = activeCategory === 'all' || activeCategory === cat.id
        if (!matchesCat) return false
        if (!q) return true
        return (
          item.name.toLowerCase().includes(q) ||
          (item.desc[l] ?? item.desc['en'] ?? '').toLowerCase().includes(q)
        )
      }),
    })).filter((cat) => cat.items.length > 0)
  }, [query, activeCategory, l])

  const totalCount = CATALOG.reduce((n, cat) => n + cat.items.length, 0)

  return (
    <div className="mcp-catalog">
      {/* Search */}
      <div className="mcp-catalog-search-wrap">
        <svg className="mcp-catalog-search-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="mcp-catalog-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER[l]}
          aria-label={SEARCH_PLACEHOLDER[l]}
        />
        {query && (
          <button className="mcp-catalog-search-clear" onClick={() => setQuery('')} aria-label="Clear">×</button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="mcp-catalog-cats" role="tablist">
        <button
          role="tab"
          className={`mcp-catalog-cat${activeCategory === 'all' ? ' is-active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          {CAT_LABEL_ALL[l]} <span className="mcp-catalog-cat-count">{totalCount}</span>
        </button>
        {CATALOG.map((cat) => (
          <button
            key={cat.id}
            role="tab"
            className={`mcp-catalog-cat${activeCategory === cat.id ? ' is-active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label[l] ?? cat.label.en}
            <span className="mcp-catalog-cat-count">{cat.items.length}</span>
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="mcp-catalog-empty">
          {l === 'es' ? 'Sin resultados' : l === 'fr' ? 'Aucun résultat' : l === 'de' ? 'Keine Ergebnisse' : l === 'nl' ? 'Geen resultaten' : l === 'it' ? 'Nessun risultato' : 'No results'}
        </p>
      ) : (
        filtered.map((cat) => (
          <div key={cat.id} className="mcp-catalog-group">
            {activeCategory === 'all' && (
              <h4 className="mcp-catalog-group-title">{cat.label[l] ?? cat.label.en}</h4>
            )}
            <div className="mcp-catalog-grid">
              {cat.items.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mcp-catalog-card"
                >
                  <span className="mcp-catalog-card-icon" style={{ background: item.color + '18', color: item.color }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill={item.color}>
                      <path d={item.icon} />
                    </svg>
                  </span>
                  <span className="mcp-catalog-card-body">
                    <span className="mcp-catalog-card-name">{item.name}</span>
                    <span className="mcp-catalog-card-desc">{item.desc[l] ?? item.desc['en'] ?? ''}</span>
                  </span>
                  <svg className="mcp-catalog-card-arrow" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                  </svg>
                </a>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
