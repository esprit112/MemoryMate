import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  document: {
    name: string;
    type: string;
    mimeType: string;
    data: string;
    file_blob?: string;
  };
  onClose: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onClose }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const prevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const nextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));

  const isPdf = document.type === 'pdf' || document.mimeType === 'application/pdf';
  const sourceData = document.file_blob || document.data;
  const fileUrl = `data:${document.mimeType};base64,${sourceData}`;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-sm flex flex-col p-4 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center text-white mb-4 mt-4 bg-slate-800/50 p-3 rounded-2xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold truncate max-w-[200px] sm:max-w-md md:max-w-xl">
            {document.name}
          </h2>
          
          {isPdf && numPages && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-white/10">
              <button onClick={prevPage} disabled={pageNumber <= 1} className="p-1 hover:bg-white/10 rounded disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium">Page {pageNumber} of {numPages}</span>
              <button onClick={nextPage} disabled={pageNumber >= numPages} className="p-1 hover:bg-white/10 rounded disabled:opacity-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {isPdf && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/50 px-2 py-1.5 rounded-lg border border-white/10">
              <button onClick={zoomOut} className="p-1 hover:bg-white/10 rounded">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={zoomIn} className="p-1 hover:bg-white/10 rounded">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <button 
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-xl transition-colors border border-red-500/30"
        >
          <span className="hidden sm:inline font-medium">Close Viewer</span>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-slate-950/50 rounded-2xl overflow-auto flex items-center justify-center relative border border-white/5 shadow-inner p-4">
        {isPdf ? (
          <div className="max-w-full overflow-auto flex justify-center">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex flex-col items-center text-slate-400 gap-3">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p>Loading PDF...</p>
                </div>
              }
              error={
                <div className="text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-500/30">
                  Failed to load PDF. The file might be corrupted or too large.
                </div>
              }
              className="shadow-2xl"
            >
              <Page 
                pageNumber={pageNumber} 
                scale={scale} 
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="bg-white rounded-sm overflow-hidden"
              />
            </Document>
          </div>
        ) : (
          <img 
            src={fileUrl} 
            alt={document.name}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        )}
      </div>
      
      {/* Mobile Controls (Bottom) */}
      {isPdf && numPages && (
        <div className="sm:hidden mt-4 flex justify-between items-center bg-slate-800/50 p-3 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2">
            <button onClick={prevPage} disabled={pageNumber <= 1} className="p-2 bg-slate-900/50 hover:bg-white/10 rounded-lg disabled:opacity-50 border border-white/5">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium px-2">{pageNumber} / {numPages}</span>
            <button onClick={nextPage} disabled={pageNumber >= numPages} className="p-2 bg-slate-900/50 hover:bg-white/10 rounded-lg disabled:opacity-50 border border-white/5">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={zoomOut} className="p-2 bg-slate-900/50 hover:bg-white/10 rounded-lg border border-white/5">
              <ZoomOut className="w-5 h-5" />
            </button>
            <button onClick={zoomIn} className="p-2 bg-slate-900/50 hover:bg-white/10 rounded-lg border border-white/5">
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>,
    window.document.body
  );
};

export default DocumentViewer;
