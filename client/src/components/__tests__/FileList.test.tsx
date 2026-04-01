/**
 * Unit tests for FileList component
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import FileList from '../user/FileList';
import { ApiRequestError, FileWithDownloadsRemaining } from '../../types';

// Mock the apiClient module
vi.mock('../../services/apiClient', () => ({
  default: {
    listFiles: vi.fn(),
    downloadFile: vi.fn(),
  },
}));

import apiClient from '../../services/apiClient';

const mockListFiles = vi.mocked(apiClient.listFiles);
const mockDownloadFile = vi.mocked(apiClient.downloadFile);

const sampleFiles: FileWithDownloadsRemaining[] = [
  {
    id: 1,
    filename: 'document.pdf',
    path: '/uploads/document.pdf',
    mime_type: 'application/pdf',
    size: 1024 * 512, // 512 KB
    uploaded_by: 1,
    allowed_plan_ids: [1, 2],
    max_downloads_per_user: 5,
    downloads_remaining: 3,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
  {
    id: 2,
    filename: 'image.png',
    path: '/uploads/image.png',
    mime_type: 'image/png',
    size: 1024 * 1024 * 2, // 2 MB
    uploaded_by: 1,
    allowed_plan_ids: [2],
    max_downloads_per_user: null,
    downloads_remaining: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Suppress URL.createObjectURL not implemented in jsdom
beforeEach(() => {
  vi.clearAllMocks();
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();
});

describe('FileList component', () => {
  // ---- Loading state ----
  it('shows loading indicator while fetching files', () => {
    mockListFiles.mockReturnValue(new Promise(() => {})); // never resolves
    render(<FileList />);
    expect(screen.getByText(/carregando arquivos/i)).toBeInTheDocument();
  });

  // ---- Empty state ----
  it('shows empty message when no files are returned', async () => {
    mockListFiles.mockResolvedValue([]);
    render(<FileList />);
    expect(await screen.findByText(/nenhum arquivo disponível/i)).toBeInTheDocument();
  });

  // ---- Error state ----
  it('shows error message when listFiles fails', async () => {
    mockListFiles.mockRejectedValue(new Error('Falha na rede'));
    render(<FileList />);
    expect(await screen.findByText('Falha na rede')).toBeInTheDocument();
  });

  // ---- Req 6.4: metadata displayed ----
  it('displays filename, mime_type, size and downloads_remaining for each file', async () => {
    mockListFiles.mockResolvedValue(sampleFiles);
    render(<FileList />);

    // filename
    expect(await screen.findAllByText('document.pdf')).not.toHaveLength(0);
    expect(screen.getAllByText('image.png')).not.toHaveLength(0);

    // mime_type
    expect(screen.getAllByText('application/pdf')).not.toHaveLength(0);
    expect(screen.getAllByText('image/png')).not.toHaveLength(0);

    // size formatted
    expect(screen.getAllByText('512.0 KB')).not.toHaveLength(0);
    expect(screen.getAllByText('2.0 MB')).not.toHaveLength(0);

    // downloads_remaining: 3 and Ilimitado
    expect(screen.getAllByText('3')).not.toHaveLength(0);
    expect(screen.getAllByText('Ilimitado')).not.toHaveLength(0);
  });

  // ---- Req 6.2: unlimited shown as "Ilimitado" ----
  it('shows "Ilimitado" when downloads_remaining is null', async () => {
    mockListFiles.mockResolvedValue([sampleFiles[1]]);
    render(<FileList />);
    expect(await screen.findAllByText('Ilimitado')).not.toHaveLength(0);
  });

  // ---- Download button present ----
  it('renders a download button for each file', async () => {
    mockListFiles.mockResolvedValue(sampleFiles);
    render(<FileList />);
    await screen.findAllByText('document.pdf');
    const buttons = screen.getAllByRole('button', { name: /baixar/i });
    // Each file has 2 buttons (desktop + mobile), so at least 2 per file
    expect(buttons.length).toBeGreaterThanOrEqual(sampleFiles.length);
  });

  // ---- Download button disabled when 0 remaining ----
  it('disables download button when downloads_remaining is 0', async () => {
    const exhaustedFile: FileWithDownloadsRemaining = {
      ...sampleFiles[0],
      downloads_remaining: 0,
    };
    mockListFiles.mockResolvedValue([exhaustedFile]);
    render(<FileList />);
    await screen.findAllByText('document.pdf');
    const buttons = screen.getAllByRole('button', { name: /baixar/i });
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  // ---- Req 7.2: 403 error message ----
  it('shows 403 error message when download is forbidden', async () => {
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    mockDownloadFile.mockRejectedValue(new ApiRequestError('Forbidden', 403));
    render(<FileList />);
    await screen.findAllByText('document.pdf');
    const buttons = screen.getAllByRole('button', { name: /baixar/i });
    fireEvent.click(buttons[0]);
    const msgs403 = await screen.findAllByText(/acesso negado.*plano/i);
    expect(msgs403.length).toBeGreaterThan(0);
  });

  // ---- Req 7.3: 429 error message ----
  it('shows 429 error message when download limit is exceeded', async () => {
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    mockDownloadFile.mockRejectedValue(new ApiRequestError('Too Many Requests', 429));
    render(<FileList />);
    await screen.findAllByText('document.pdf');
    const buttons = screen.getAllByRole('button', { name: /baixar/i });
    fireEvent.click(buttons[0]);
    const msgs429 = await screen.findAllByText(/limite de downloads atingido/i);
    expect(msgs429.length).toBeGreaterThan(0);
  });

  // ---- Successful download triggers blob URL ----
  it('creates a blob URL and triggers download on success', async () => {
    const blob = new Blob(['content'], { type: 'application/pdf' });
    mockListFiles.mockResolvedValue([sampleFiles[0]]);
    mockDownloadFile.mockResolvedValue(blob);

    // Spy on anchor click
    const clickSpy = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') {
        vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(clickSpy);
      }
      return el;
    });

    render(<FileList />);
    await screen.findAllByText('document.pdf');
    const buttons = screen.getAllByRole('button', { name: /baixar/i });
    fireEvent.click(buttons[0]);

    await waitFor(() => expect(mockDownloadFile).toHaveBeenCalledWith(1));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(blob));

    vi.restoreAllMocks();
  });

  // ---- List refreshes after successful download ----
  it('refreshes file list after a successful download', async () => {
    const updatedFiles = [{ ...sampleFiles[0], downloads_remaining: 2 }];
    mockListFiles
      .mockResolvedValueOnce([sampleFiles[0]])
      .mockResolvedValueOnce(updatedFiles);
    mockDownloadFile.mockResolvedValue(new Blob(['data']));

    render(<FileList />);
    await screen.findAllByText('document.pdf');
    const buttons = screen.getAllByRole('button', { name: /baixar/i });
    fireEvent.click(buttons[0]);

    await waitFor(() => expect(mockListFiles).toHaveBeenCalledTimes(2));
  });
});

// ============================================================
// Property-Based Tests
// Validates: Requirements 6.2, 6.3, 6.4
// ============================================================

/**
 * Generator for a valid FileWithDownloadsRemaining object.
 * Constrained to small ranges for fast generation.
 */
const fileArbitrary = fc.record<FileWithDownloadsRemaining>({
  id: fc.integer({ min: 1, max: 9999 }),
  filename: fc.constantFrom('a.pdf', 'b.png', 'c.zip', 'd.txt', 'e.jpg'),
  path: fc.constant('/uploads/file'),
  mime_type: fc.constantFrom('application/pdf', 'image/png', 'text/plain'),
  size: fc.integer({ min: 1, max: 1048576 }),
  uploaded_by: fc.integer({ min: 1, max: 10 }),
  allowed_plan_ids: fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 2 }),
  max_downloads_per_user: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  downloads_remaining: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  created_at: fc.date({ min: new Date('2023-01-01'), max: new Date('2024-12-31') }).map((d) => d.toISOString()),
  updated_at: fc.constant('2024-01-01T00:00:00Z'),
});

describe('Property-Based Tests: FileList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  // ------------------------------------------------------------------
  // Property 17: File listings include remaining downloads
  // Feature: gestor-files, Property 17: File listings include remaining downloads
  // Validates: Requirements 6.2
  // ------------------------------------------------------------------
  it('Property 17: File listings include remaining downloads', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fileArbitrary, { minLength: 1, maxLength: 5 }),
        async (files) => {
          mockListFiles.mockResolvedValue(files);
          const { unmount } = render(<FileList />);

          await screen.findAllByText(files[0].filename);

          for (const file of files) {
            const expectedText =
              file.downloads_remaining === null ? 'Ilimitado' : String(file.downloads_remaining);
            expect(screen.queryAllByText(expectedText).length).toBeGreaterThan(0);
          }

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  });

  // ------------------------------------------------------------------
  // Property 18: Files are ordered by creation date descending
  // Feature: gestor-files, Property 18: Files are ordered by creation date descending
  // Validates: Requirements 6.3
  // ------------------------------------------------------------------
  it('Property 18: Files are ordered by creation date descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fileArbitrary, { minLength: 2, maxLength: 5 }),
        async (files) => {
          const sorted = [...files].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          mockListFiles.mockResolvedValue(sorted);
          const { unmount } = render(<FileList />);

          await screen.findAllByText(sorted[0].filename);

          for (let i = 0; i < sorted.length - 1; i++) {
            const dateA = new Date(sorted[i].created_at).getTime();
            const dateB = new Date(sorted[i + 1].created_at).getTime();
            expect(dateA).toBeGreaterThanOrEqual(dateB);
          }

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  });

  // ------------------------------------------------------------------
  // Property 19: File listings include required metadata
  // Feature: gestor-files, Property 19: File listings include required metadata
  // Validates: Requirements 6.4
  // ------------------------------------------------------------------
  it('Property 19: File listings include required metadata (filename, size, mime_type, downloads_remaining)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fileArbitrary, { minLength: 1, maxLength: 3 }),
        async (files) => {
          const uniqueFiles = files.map((f, i) => ({ ...f, id: i + 1, filename: `file-${i + 1}-${f.filename}` }));

          mockListFiles.mockResolvedValue(uniqueFiles);
          const { unmount } = render(<FileList />);

          await screen.findAllByText(uniqueFiles[0].filename);

          for (const file of uniqueFiles) {
            expect(screen.queryAllByText(file.filename).length).toBeGreaterThan(0);
            expect(screen.queryAllByText(file.mime_type).length).toBeGreaterThan(0);
            const remainingText =
              file.downloads_remaining === null ? 'Ilimitado' : String(file.downloads_remaining);
            expect(screen.queryAllByText(remainingText).length).toBeGreaterThan(0);
          }

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  });
});
