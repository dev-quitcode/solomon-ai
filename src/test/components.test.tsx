import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MarkdownViewer from '@/components/charter/MarkdownViewer'
import ProjectCard from '@/components/project/ProjectCard'
import type { Project } from '@/types'

// Mock Next.js Link (renders as <a> in tests)
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// ──────────────────────────────────────────────────────────────
// MarkdownViewer
// ──────────────────────────────────────────────────────────────

describe('MarkdownViewer', () => {
  it('renders plain text content', () => {
    render(<MarkdownViewer content="Hello world" />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders markdown headings', async () => {
    render(<MarkdownViewer content="# Project Charter" />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toBeInTheDocument()
    expect(h1).toHaveTextContent('Project Charter')
  })

  it('renders h2 headings', () => {
    render(<MarkdownViewer content="## Business Case" />)
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2).toHaveTextContent('Business Case')
  })

  it('renders bold text', () => {
    render(<MarkdownViewer content="This is **important**." />)
    const strong = document.querySelector('strong')
    expect(strong).toBeInTheDocument()
    expect(strong?.textContent).toBe('important')
  })

  it('renders bullet list items as text', () => {
    render(<MarkdownViewer content={'- Item one\n- Item two\n- Item three'} />)
    // react-markdown renders list items; check the ul container and text presence
    expect(document.querySelector('ul')).toBeInTheDocument()
    expect(screen.getByText('Item one')).toBeInTheDocument()
    expect(screen.getByText('Item two')).toBeInTheDocument()
    expect(screen.getByText('Item three')).toBeInTheDocument()
  })

  it('renders numbered list as ol element', () => {
    render(<MarkdownViewer content={'1. First\n2. Second'} />)
    expect(document.querySelector('ol')).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('renders inline code', () => {
    render(<MarkdownViewer content="Use `npm install` to install." />)
    const code = document.querySelector('code')
    expect(code).toBeInTheDocument()
    expect(code?.textContent).toBe('npm install')
  })

  it('renders content around a horizontal rule', () => {
    // react-markdown + remark-gfm renders <hr> but jsdom may differ;
    // verify the surrounding text is at minimum present
    render(<MarkdownViewer content={'Above\n\n---\n\nBelow'} />)
    expect(screen.getByText('Above')).toBeInTheDocument()
    expect(screen.getByText('Below')).toBeInTheDocument()
  })

  it('renders GFM table text content', () => {
    // Verify that table cell text is rendered (remark-gfm enabled)
    render(<MarkdownViewer content={'| Col A | Col B |\n| --- | --- |\n| Val 1 | Val 2 |'} />)
    expect(screen.getByText('Col A')).toBeInTheDocument()
    expect(screen.getByText('Val 1')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<MarkdownViewer content="Test" className="my-custom-class" />)
    expect(container.firstChild).toHaveClass('my-custom-class')
  })

  it('renders empty content without crashing', () => {
    const { container } = render(<MarkdownViewer content="" />)
    expect(container).toBeInTheDocument()
  })

  it('renders blockquote', () => {
    render(<MarkdownViewer content="> This is a quote" />)
    const blockquote = document.querySelector('blockquote')
    expect(blockquote).toBeInTheDocument()
    expect(blockquote?.textContent).toContain('This is a quote')
  })
})

// ──────────────────────────────────────────────────────────────
// ProjectCard
// ──────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-001',
    user_id: 'user-001',
    name: 'Solomon CRM',
    client_name: null,
    industry: 'Technology',
    type: 'greenfield',
    mode: 'epics_and_stories',
    status: 'setup',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    github_repo_url: null,
    github_exported_at: null,
    github_sync_error: null,
    ...overrides,
  }
}

describe('ProjectCard', () => {
  it('renders the project name', () => {
    render(<ProjectCard project={makeProject()} />)
    expect(screen.getByText('Solomon CRM')).toBeInTheDocument()
  })

  it('links to the correct project URL', () => {
    render(<ProjectCard project={makeProject({ id: 'proj-abc' })} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/project/proj-abc')
  })

  it('shows client name when provided', () => {
    render(<ProjectCard project={makeProject({ client_name: 'Acme Corp' })} />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('does not render client section when client_name is null', () => {
    render(<ProjectCard project={makeProject({ client_name: null })} />)
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('shows the correct status badge for setup', () => {
    render(<ProjectCard project={makeProject({ status: 'setup' })} />)
    expect(screen.getByText('Setup')).toBeInTheDocument()
  })

  it('shows the correct status badge for approved', () => {
    render(<ProjectCard project={makeProject({ status: 'approved' })} />)
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('shows all pipeline statuses correctly', () => {
    const statuses: Project['status'][] = ['setup', 'sources', 'charter', 'prd', 'epics', 'stories', 'approved']
    const labels = ['Setup', 'Sources', 'Charter', 'PRD', 'Epics', 'Stories', 'Approved']

    statuses.forEach((status, i) => {
      const { unmount } = render(<ProjectCard project={makeProject({ status })} />)
      expect(screen.getByText(labels[i])).toBeInTheDocument()
      unmount()
    })
  })

  it('shows "greenfield" type badge', () => {
    render(<ProjectCard project={makeProject({ type: 'greenfield' })} />)
    expect(screen.getByText('greenfield')).toBeInTheDocument()
  })

  it('shows "brownfield" type badge', () => {
    render(<ProjectCard project={makeProject({ type: 'brownfield' })} />)
    expect(screen.getByText('brownfield')).toBeInTheDocument()
  })

  it('shows "Epics + Stories" mode badge', () => {
    render(<ProjectCard project={makeProject({ mode: 'epics_and_stories' })} />)
    expect(screen.getByText('Epics + Stories')).toBeInTheDocument()
  })

  it('shows "Stories only" mode badge', () => {
    render(<ProjectCard project={makeProject({ mode: 'stories_only' })} />)
    expect(screen.getByText('Stories only')).toBeInTheDocument()
  })

  it('renders a relative time for created_at', () => {
    // The card renders formatDistanceToNow — just check it renders some time text
    render(<ProjectCard project={makeProject({ created_at: new Date(Date.now() - 60000).toISOString() })} />)
    const timeText = screen.getByText(/ago/i)
    expect(timeText).toBeInTheDocument()
  })
})
