import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Plus,
  ExternalLink,
  Trash2,
  Edit2,
  Layers,
  Database,
  Compass,
  Code2,
  BookOpen,
  Upload,
  Link as LinkIcon,
  X,
  FileDown,
  FileCode,
  FileSpreadsheet,
  FileCheck,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { formatDateTimeVN } from '../techHelpers';

const DOC_TYPE_CONFIG = {
  ARCHITECTURE_SPEC: {
    label: 'Kiến trúc & C4 Specs',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: Layers,
  },
  API_SWAGGER: {
    label: 'Swagger / Postman API',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: Code2,
  },
  FIGMA_DESIGN: {
    label: 'Figma UI / Design Specs',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Compass,
  },
  DATABASE_ERD: {
    label: 'Sơ đồ DB / ERD',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: Database,
  },
  RUNBOOK_GUIDE: {
    label: 'Runbook & Triển khai',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: BookOpen,
  },
  OTHER: {
    label: 'Tài liệu Khác',
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: FileText,
  },
};

const KNOWN_FILE_EXTENSIONS = [
  'PDF', 'DOCX', 'DOC', 'XLSX', 'XLS', 'CSV', 'PPTX', 'PPT',
  'MD', 'JSON', 'YAML', 'YML', 'SQL', 'PNG', 'JPG', 'JPEG',
  'SVG', 'DRAWIO', 'VSDX', 'ZIP'
];

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const getFileExtension = (url) => {
  if (!url) return '';
  try {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const lastSlash = cleanUrl.lastIndexOf('/');
    const lastSegment = lastSlash !== -1 ? cleanUrl.substring(lastSlash + 1) : cleanUrl;
    if (!lastSegment || !lastSegment.includes('.')) return '';
    const ext = lastSegment.substring(lastSegment.lastIndexOf('.') + 1).toUpperCase();
    if (KNOWN_FILE_EXTENSIONS.includes(ext) || /^[A-Z0-9]{1,6}$/.test(ext)) {
      return ext;
    }
    return '';
  } catch {
    return '';
  }
};

export default function ProjectArchitectureDocsPanel({
  projectId,
  canManage = false,
}) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Form mode: 'file' | 'url'
  const [attachMode, setAttachMode] = useState('file');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form inputs (Add)
  const [docType, setDocType] = useState('ARCHITECTURE_SPEC');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit State & inputs
  const [editingDoc, setEditingDoc] = useState(null);
  const [editDocType, setEditDocType] = useState('ARCHITECTURE_SPEC');
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAttachMode, setEditAttachMode] = useState('keep'); // 'keep' | 'url' | 'file'
  const [editSelectedFile, setEditSelectedFile] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/tech/projects/${projectId}/documents`);
      if (res.data?.data) {
        setDocs(res.data.data);
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể tải tài liệu dự án', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleFileSelect = (file) => {
    if (!file) return;

    // Check size limit: 20MB
    if (file.size > 20 * 1024 * 1024) {
      toast?.show('Tệp quá lớn', 'Dung lượng tệp không được vượt quá 20MB!', 'warning');
      return;
    }

    setSelectedFile(file);

    // Auto-fill title if empty
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!title.trim()) {
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setTitle(baseName.replace(/[_-]/g, ' ').trim());
    }

    // Auto-suggest docType based on extension
    if (ext === 'sql') {
      setDocType('DATABASE_ERD');
    } else if (['json', 'yaml', 'yml'].includes(ext)) {
      setDocType('API_SWAGGER');
    } else if (ext === 'md') {
      setDocType('RUNBOOK_GUIDE');
    } else if (['png', 'jpg', 'jpeg', 'svg', 'drawio', 'vsdx'].includes(ext)) {
      setDocType('ARCHITECTURE_SPEC');
    } else if (['pdf', 'docx', 'doc'].includes(ext)) {
      setDocType('ARCHITECTURE_SPEC');
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();

    if (attachMode === 'file') {
      if (!selectedFile) {
        toast?.show('Chưa chọn tệp', 'Vui lòng chọn hoặc kéo thả tệp tin từ máy tính', 'warning');
        return;
      }
      if (!title.trim()) {
        toast?.show('Thiếu thông tin', 'Vui lòng nhập tên tài liệu', 'warning');
        return;
      }

      try {
        setSubmitting(true);
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', title.trim());
        formData.append('docType', docType);
        if (description.trim()) {
          formData.append('description', description.trim());
        }

        const res = await api.post(`/api/tech/projects/${projectId}/documents/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (res.data?.data) {
          setDocs((prev) => [res.data.data, ...prev]);
          toast?.show('Thành công', 'Đã tải lên và đính kèm tài liệu thành công', 'success');
          resetForm();
        }
      } catch (err) {
        toast?.show('Lỗi tải tệp', err.response?.data?.message || 'Không thể tải lên tệp tin', 'error');
      } finally {
        setSubmitting(false);
      }
    } else {
      // URL mode
      if (!title.trim() || !url.trim()) {
        toast?.show('Thiếu thông tin', 'Vui lòng nhập tên tài liệu và URL liên kết', 'warning');
        return;
      }
      try {
        setSubmitting(true);
        const res = await api.post(`/api/tech/projects/${projectId}/documents`, {
          docType,
          title: title.trim(),
          url: url.trim(),
          description: description.trim() || null,
        });
        if (res.data?.data) {
          setDocs((prev) => [res.data.data, ...prev]);
          toast?.show('Thành công', 'Đã thêm tài liệu kiến trúc dự án', 'success');
          resetForm();
        }
      } catch (err) {
        toast?.show('Lỗi', err.response?.data?.message || 'Không thể lưu tài liệu', 'error');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const resetForm = () => {
    setTitle('');
    setUrl('');
    setDescription('');
    setSelectedFile(null);
    setIsAdding(false);
  };

  const handleStartEdit = (doc) => {
    setEditingDoc(doc);
    setEditDocType(doc.docType);
    setEditTitle(doc.title);
    setEditDescription(doc.description || '');
    setEditSelectedFile(null);
    const isDocFile =
      doc.url?.includes('/uploads/') ||
      doc.url?.includes('cloudinary.com') ||
      Boolean(getFileExtension(doc.url));
    if (isDocFile) {
      setEditUrl('');
      setEditAttachMode('keep');
    } else {
      setEditUrl(doc.url);
      setEditAttachMode('url');
    }
  };

  const handleCancelEdit = () => {
    setEditingDoc(null);
    setEditSelectedFile(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingDoc) return;

    if (!editTitle.trim()) {
      toast?.show('Thiếu thông tin', 'Vui lòng nhập tên tài liệu', 'warning');
      return;
    }

    try {
      setEditSubmitting(true);
      if (editAttachMode === 'file' && editSelectedFile) {
        const formData = new FormData();
        formData.append('file', editSelectedFile);
        formData.append('title', editTitle.trim());
        formData.append('docType', editDocType);
        if (editDescription.trim()) {
          formData.append('description', editDescription.trim());
        }

        const res = await api.post(
          `/api/tech/projects/${projectId}/documents/${editingDoc.id}/upload`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        );

        if (res.data?.data) {
          setDocs((prev) => prev.map((d) => (d.id === editingDoc.id ? res.data.data : d)));
          toast?.show('Thành công', 'Đã cập nhật tài liệu và tải lên tệp mới thành công', 'success');
          handleCancelEdit();
        }
      } else {
        const finalUrl = editAttachMode === 'url' ? editUrl.trim() : editingDoc.url;
        if (!finalUrl) {
          toast?.show('Thiếu thông tin', 'Đường dẫn liên kết không được để trống', 'warning');
          return;
        }

        const res = await api.put(
          `/api/tech/projects/${projectId}/documents/${editingDoc.id}`,
          {
            docType: editDocType,
            title: editTitle.trim(),
            url: finalUrl,
            description: editDescription.trim() || null,
          }
        );

        if (res.data?.data) {
          setDocs((prev) => prev.map((d) => (d.id === editingDoc.id ? res.data.data : d)));
          toast?.show('Thành công', 'Đã cập nhật thông tin tài liệu thành công', 'success');
          handleCancelEdit();
        }
      }
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể cập nhật tài liệu', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Delete Document Confirmation Modal State
  const [deleteDocTarget, setDeleteDocTarget] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const handleConfirmDeleteDoc = async () => {
    if (!deleteDocTarget) return;
    try {
      setDeletingDoc(true);
      await api.delete(`/api/tech/projects/${projectId}/documents/${deleteDocTarget.id}`);
      setDocs((prev) => prev.filter((d) => d.id !== deleteDocTarget.id));
      toast?.show('Đã xóa', 'Đã xóa tài liệu khỏi dự án', 'info');
      setDeleteDocTarget(null);
      if (onDocCountChanged) onDocCountChanged();
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể xóa tài liệu', 'error');
    } finally {
      setDeletingDoc(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-blue-600 shrink-0" />
          <h4 className="text-sm font-bold text-slate-900">
            Tài liệu Kiến trúc, Specs &amp; Runbook ({docs.length})
          </h4>
        </div>

        {canManage && !isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Thêm tài liệu</span>
          </button>
        )}
      </div>

      {/* Add Document Inline Form */}
      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="p-5 bg-blue-50/50 border border-blue-200/80 rounded-2xl space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-bold text-blue-950 flex items-center gap-2">
              <Upload size={16} className="text-blue-600" />
              <span>Đính kèm Tài liệu / Specs Kỹ thuật mới</span>
            </h5>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              <X size={16} />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setAttachMode('file')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                attachMode === 'file'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload size={13} />
              <span>Tải tệp tin từ máy tính</span>
            </button>
            <button
              type="button"
              onClick={() => setAttachMode('url')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                attachMode === 'url'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LinkIcon size={13} />
              <span>Nhập đường dẫn URL</span>
            </button>
          </div>

          {/* Mode 1: File Upload */}
          {attachMode === 'file' && (
            <div className="space-y-3">
              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                  }}
                  className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition ${
                    isDragging
                      ? 'border-blue-500 bg-blue-100/60'
                      : 'border-slate-300 hover:border-blue-400 bg-white'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.md,.json,.yaml,.yml,.sql,.png,.jpg,.jpeg,.svg,.drawio,.vsdx,.zip"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                    }}
                  />
                  <Upload size={28} className="mx-auto text-blue-600 mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    Kéo thả tệp vào đây hoặc <span className="text-blue-600 underline">bấm để chọn tệp</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xl mx-auto leading-relaxed">
                    Hỗ trợ: PDF, Word (DOCX), Excel (XLSX), Slide (PPTX), Markdown (MD), YAML/JSON (OpenAPI), SQL, Ảnh &amp; Sơ đồ Draw.io, ZIP (Tối đa 20MB)
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-white border border-blue-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100 font-bold text-xs uppercase">
                      {getFileExtension(selectedFile.name) || 'FILE'}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-bold text-slate-900 truncate">{selectedFile.name}</p>
                      <p className="text-[11px] text-slate-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                    >
                      Đổi tệp khác
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Hủy chọn tệp"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.md,.json,.yaml,.yml,.sql,.png,.jpg,.jpeg,.svg,.drawio,.vsdx,.zip"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Mode 2: URL Input */}
          {attachMode === 'url' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Đường dẫn liên kết (URL / Wiki / Swagger / Confluence / Figma) <span className="text-rose-500">*</span>
              </label>
              <input
                type="url"
                required={attachMode === 'url'}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://wiki.internal/docs/architecture-v2"
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Common Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Phân loại Tài liệu <span className="text-rose-500">*</span>
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer font-medium"
              >
                {Object.entries(DOC_TYPE_CONFIG).map(([key, conf]) => (
                  <option key={key} value={key}>
                    {conf.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Tên tài liệu / Tiêu đề Specs <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: C4 Model & Microservices Architecture"
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Mô tả ngắn gọn (tùy chọn)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú thêm về phiên bản hoặc phạm vi áp dụng..."
              className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-xl transition cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {submitting ? 'Đang lưu tài liệu...' : 'Lưu tài liệu'}
            </button>
          </div>
        </form>
      )}

      {/* Docs List */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Đang tải danh sách tài liệu...</div>
      ) : docs.length === 0 ? (
        <div className="p-6 bg-slate-50/70 rounded-2xl border border-slate-200/80 text-center text-xs text-slate-400">
          Chưa có tài liệu kiến trúc hoặc specs nào được đính kèm vào dự án này.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {docs.map((doc) => {
            const conf = DOC_TYPE_CONFIG[doc.docType] || DOC_TYPE_CONFIG.OTHER;
            const Icon = conf.icon;
            const isLocalUpload = doc.url?.includes('/uploads/');
            const isCloudinary = doc.url?.includes('cloudinary.com');
            const ext = getFileExtension(doc.url);
            const isFile = isLocalUpload || isCloudinary || Boolean(ext);

            // Compute file icon
            let FileTypeIcon = FileText;
            if (['SQL', 'JSON', 'YAML', 'YML'].includes(ext)) FileTypeIcon = FileCode;
            else if (['XLSX', 'XLS', 'CSV'].includes(ext)) FileTypeIcon = FileSpreadsheet;
            else if (['PDF'].includes(ext)) FileTypeIcon = FileCheck;

            const CardIcon = isFile ? FileTypeIcon : Icon;

            // Direct download link
            const targetUrl = doc.url?.startsWith('http') ? doc.url : doc.url;

            // Compute clean badge label
            let badgeLabel = 'LIÊN KẾT';
            if (isFile) {
              if (ext) {
                badgeLabel = `TỆP ${ext}`;
              } else if (doc.docType === 'DATABASE_ERD') {
                badgeLabel = 'TỆP SQL / DB';
              } else if (doc.docType === 'API_SWAGGER') {
                badgeLabel = 'TỆP API SPECS';
              } else {
                badgeLabel = 'TỆP TẢI LÊN';
              }
            }

            return (
              <div
                key={doc.id}
                className="p-4 bg-white border border-slate-200 rounded-xl flex items-start justify-between gap-3 hover:border-blue-300 transition group shadow-2xs"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${conf.color}`}
                  >
                    <CardIcon size={17} />
                  </div>
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${conf.color}`}>
                        {conf.label}
                      </span>
                      {isFile ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 uppercase tabular">
                          {badgeLabel}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          LIÊN KẾT
                        </span>
                      )}
                    </div>

                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-slate-900 group-hover:text-blue-700 flex items-center gap-1.5 truncate block"
                      title={doc.title}
                    >
                      <span className="truncate">{doc.title}</span>
                      {isFile ? (
                        <FileDown size={13} className="shrink-0 text-blue-600 opacity-80" />
                      ) : (
                        <ExternalLink size={12} className="shrink-0 opacity-70" />
                      )}
                    </a>

                    {doc.description && (
                      <p className="text-[11px] text-slate-500 truncate" title={doc.description}>
                        {doc.description}
                      </p>
                    )}

                    <p className="text-[10px] text-slate-400 tabular">
                      Đăng bởi {doc.createdByName || 'Kỹ sư'} • {formatDateTimeVN(doc.createdAt)}
                    </p>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(doc)}
                      className="p-1 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                      title="Chỉnh sửa tài liệu"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteDocTarget(doc)}
                      className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Xóa tài liệu"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Document Modal */}
      {editingDoc &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
              <div className="px-6 py-4 bg-[#0F2557] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-blue-300" />
                <h3 className="text-sm font-bold">Chỉnh sửa Tài liệu Kỹ thuật</h3>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-slate-300 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {/* Document Type Badge & Status Card */}
              {(() => {
                const isDocFile =
                  editingDoc.url?.includes('/uploads/') ||
                  editingDoc.url?.includes('cloudinary.com') ||
                  Boolean(getFileExtension(editingDoc.url));

                if (isDocFile) {
                  return (
                    <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200/60 font-bold text-xs">
                          <FileDown size={18} />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                              Tệp tin đã tải lên
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {editingDoc.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Tệp tin đang được lưu trữ an toàn trên máy chủ hệ thống
                          </p>
                        </div>
                      </div>
                      <a
                        href={editingDoc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg shadow-2xs transition inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        title="Tải về hoặc mở xem tệp tin hiện tại"
                      >
                        <span>Xem / Tải về</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  );
                }

                return (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                        <LinkIcon size={15} />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          LIÊN KẾT NGOÀI (URL)
                        </span>
                        <p className="text-xs font-medium text-slate-600 truncate max-w-sm" title={editingDoc.url}>
                          {editingDoc.url}
                        </p>
                      </div>
                    </div>
                    <a
                      href={editingDoc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1 shrink-0"
                    >
                      <span>Mở link</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                );
              })()}

              {/* Storage Method Selector */}
              {(() => {
                const isDocFile =
                  editingDoc.url?.includes('/uploads/') ||
                  editingDoc.url?.includes('cloudinary.com') ||
                  Boolean(getFileExtension(editingDoc.url));

                if (isDocFile) {
                  return (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 block">
                        Thao tác đối với tệp tin
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl w-full">
                        <button
                          type="button"
                          onClick={() => {
                            setEditAttachMode('keep');
                            setEditSelectedFile(null);
                          }}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap text-center ${
                            editAttachMode === 'keep'
                              ? 'bg-white text-blue-700 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>📌 Giữ nguyên tệp hiện tại</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditAttachMode('file')}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap text-center ${
                            editAttachMode === 'file'
                              ? 'bg-white text-blue-700 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Upload size={12} className="shrink-0" />
                          <span>Tải tệp mới thay thế</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditAttachMode('url')}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap text-center ${
                            editAttachMode === 'url'
                              ? 'bg-white text-blue-700 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <LinkIcon size={12} className="shrink-0" />
                          <span>Chuyển sang đường dẫn URL</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Phương thức liên kết
                    </label>
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit flex-wrap">
                      <button
                        type="button"
                        onClick={() => setEditAttachMode('url')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          editAttachMode === 'url'
                            ? 'bg-white text-blue-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <LinkIcon size={12} />
                        <span>Chỉnh sửa đường dẫn URL</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditAttachMode('file')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          editAttachMode === 'file'
                            ? 'bg-white text-blue-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Upload size={12} />
                        <span>Đổi sang tải tệp tin</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Mode URL */}
              {editAttachMode === 'url' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Đường dẫn liên kết (URL / Wiki / Swagger / Figma / Miro) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="url"
                    required={editAttachMode === 'url'}
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="https://wiki.company.internal/docs/architecture-v2"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium"
                  />
                  <p className="text-[11px] text-slate-500">
                    Nhập đường dẫn trang web tài liệu bạn muốn liên kết tới.
                  </p>
                </div>
              )}

              {/* Mode File */}
              {editAttachMode === 'file' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Chọn tệp tin mới thay thế (&le; 20MB) <span className="text-rose-500">*</span>
                  </label>
                  {!editSelectedFile ? (
                    <div
                      onClick={() => editFileInputRef.current?.click()}
                      className="p-4 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl text-center cursor-pointer transition bg-slate-50/50"
                    >
                      <Upload size={22} className="mx-auto text-blue-600 mb-1" />
                      <p className="text-xs font-bold text-slate-800">
                        Bấm để chọn tệp tin mới tải lên
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Hỗ trợ PDF, Word, Excel, Slide, Markdown, OpenAPI, SQL, Draw.io, ZIP (&le; 20MB)
                      </p>
                      <input
                        ref={editFileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.md,.json,.yaml,.yml,.sql,.png,.jpg,.jpeg,.svg,.drawio,.vsdx,.zip"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            const file = e.target.files[0];
                            if (file.size > 20 * 1024 * 1024) {
                              toast?.show('Tệp quá lớn', 'Dung lượng không được vượt quá 20MB', 'warning');
                              return;
                            }
                            setEditSelectedFile(file);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileCheck size={18} className="text-blue-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{editSelectedFile.name}</p>
                          <p className="text-[11px] text-slate-500">{formatFileSize(editSelectedFile.size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => editFileInputRef.current?.click()}
                          className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer mr-2"
                        >
                          Đổi tệp
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditSelectedFile(null)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                          title="Hủy chọn"
                        >
                          <X size={15} />
                        </button>
                      </div>
                      <input
                        ref={editFileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.md,.json,.yaml,.yml,.sql,.png,.jpg,.jpeg,.svg,.drawio,.vsdx,.zip"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            const file = e.target.files[0];
                            if (file.size > 20 * 1024 * 1024) {
                              toast?.show('Tệp quá lớn', 'Dung lượng không được vượt quá 20MB', 'warning');
                              return;
                            }
                            setEditSelectedFile(file);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Common Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Phân loại Tài liệu <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editDocType}
                    onChange={(e) => setEditDocType(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer font-medium"
                  >
                    {Object.entries(DOC_TYPE_CONFIG).map(([key, conf]) => (
                      <option key={key} value={key}>
                        {conf.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Tên tài liệu / Tiêu đề Specs <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="VD: C4 Model & Microservices Architecture"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Mô tả ngắn gọn (tùy chọn)
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Ghi chú thêm về phiên bản hoặc phạm vi áp dụng..."
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0F2557] hover:bg-blue-900 rounded-xl transition cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {editSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* Delete Document Confirmation Modal */}
      {deleteDocTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in"
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 space-y-4 my-auto animate-in zoom-in-95 duration-150"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Xác nhận xóa tài liệu</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Bạn có chắc chắn muốn xóa tài liệu{' '}
                    <strong className="text-slate-900">{deleteDocTarget.title}</strong> khỏi dự án này không? Thao tác này không thể hoàn tác.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={deletingDoc}
                  onClick={() => setDeleteDocTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={deletingDoc}
                  onClick={handleConfirmDeleteDoc}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {deletingDoc ? 'Đang xóa...' : 'Xác nhận xóa'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
