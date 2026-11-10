import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TbFolderPlus, TbSearch, TbSortAscending2, TbSortDescending2, TbUpload, TbDownload, TbTrash, TbFolderOpen, TbRefresh } from 'react-icons/tb';
import { vaultAPI } from '../api';
import { isAdmin } from '../constants';

const ROOT_FOLDER = 'General';

function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function Vault({ user }) {
  const canManageVault = isAdmin(user?.role);

  const [vaultFiles, setVaultFiles] = useState([]);
  const [folders, setFolders] = useState([ROOT_FOLDER]);
  const [folderInput, setFolderInput] = useState('');
  const [activeFolder, setActiveFolder] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('uploadedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedUploadFolder, setSelectedUploadFolder] = useState(ROOT_FOLDER);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadVaultData = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setErrorMessage('');

    try {
      const [foldersResponse, filesResponse] = await Promise.all([
        vaultAPI.getFolders(),
        vaultAPI.getFiles(),
      ]);

      const fetchedFolders = Array.isArray(foldersResponse.data?.folders)
        ? foldersResponse.data.folders
        : [];
      const fetchedFiles = Array.isArray(filesResponse.data?.files)
        ? filesResponse.data.files
        : [];

      const nextFolders = Array.from(new Set([ROOT_FOLDER, ...fetchedFolders.filter(Boolean)]));
      setFolders(nextFolders);
      setVaultFiles(fetchedFiles);
    } catch (error) {
      console.error('Unable to load vault data:', error);
      setErrorMessage(error?.response?.data?.message || 'Failed to load Vault data from server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVaultData(true);
    const refreshInterval = window.setInterval(() => loadVaultData(), 30000);
    const refreshOnFocus = () => loadVaultData();
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [loadVaultData]);

  const visibleFiles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = vaultFiles.filter((file) => {
      const matchesFolder = activeFolder === 'All' || file.folder === activeFolder;
      if (!matchesFolder) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [file.name, file.folder, file.mimeType]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'size') {
        comparison = (a.size || 0) - (b.size || 0);
      } else if (sortBy === 'folder') {
        comparison = (a.folder || '').localeCompare(b.folder || '');
      } else {
        comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      }

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return sorted;
  }, [activeFolder, searchTerm, sortBy, sortDirection, vaultFiles]);

  const totalSize = useMemo(
    () => vaultFiles.reduce((sum, current) => sum + (current.size || 0), 0),
    [vaultFiles]
  );

  const handleCreateFolder = async () => {
    const nextFolder = folderInput.trim();
    if (!nextFolder) {
      return;
    }

    if (folders.some((folder) => folder.toLowerCase() === nextFolder.toLowerCase())) {
      setErrorMessage('Folder already exists.');
      return;
    }

    try {
      setErrorMessage('');
      await vaultAPI.createFolder(nextFolder);
      setFolders((current) => [...current, nextFolder]);
      setFolderInput('');
      setSelectedUploadFolder(nextFolder);
      setActiveFolder(nextFolder);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to create folder.');
    }
  };

  const handleDeleteFolder = async () => {
    if (!activeFolder || activeFolder === 'All' || activeFolder === ROOT_FOLDER) {
      setErrorMessage('Select a custom folder to delete.');
      return;
    }

    try {
      setErrorMessage('');
      await vaultAPI.deleteFolder(activeFolder);
      setVaultFiles((current) => current.map((file) => (
        file.folder === activeFolder ? { ...file, folder: ROOT_FOLDER } : file
      )));
      setFolders((current) => current.filter((folder) => folder !== activeFolder));
      setActiveFolder('All');
      setSelectedUploadFolder(ROOT_FOLDER);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to delete folder.');
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    setIsUploading(true);
    setErrorMessage('');

    try {
      const response = await vaultAPI.uploadFiles(files, selectedUploadFolder || ROOT_FOLDER);
      const uploaded = Array.isArray(response.data?.files) ? response.data.files : [];
      setVaultFiles((current) => [...uploaded, ...current]);
    } catch (error) {
      console.error('Upload failed:', error);
      setErrorMessage(error?.response?.data?.message || 'Upload failed for one or more files.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await vaultAPI.deleteFile(fileId);
      setVaultFiles((current) => current.filter((file) => file.id !== fileId));
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to delete file.');
    }
  };

  const handleMoveFile = async (fileId, nextFolder) => {
    try {
      await vaultAPI.moveFile(fileId, nextFolder);
      setVaultFiles((current) => current.map((file) => (
        file.id === fileId ? { ...file, folder: nextFolder } : file
      )));
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to move file.');
    }
  };

  const handleOpenFile = async (fileId, mode, fileName = 'file') => {
    try {
      const response = await vaultAPI.getFileContent(fileId, mode);
      const blobUrl = window.URL.createObjectURL(response.data);

      if (mode === 'download') {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      }

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Unable to open file.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-4">
        <h1 className="text-2xl font-bold tracking-tight text-blue-950">Vault</h1>
        <p className="text-sm text-blue-700/80 mt-1">
          Shared file library for important documents with folders, search, and sorting.
          {!canManageVault && ' You can view and download files; only Admin/HR can make changes.'}
        </p>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-lg border border-blue-100 p-3 bg-blue-50/70">
            <p className="text-xs text-blue-700/80 uppercase tracking-wide">Stored Files</p>
            <p className="text-2xl font-bold text-blue-950 mt-1">{vaultFiles.length}</p>
          </div>
          <div className="rounded-lg border border-blue-100 p-3 bg-blue-50/70">
            <p className="text-xs text-blue-700/80 uppercase tracking-wide">Folders</p>
            <p className="text-2xl font-bold text-blue-950 mt-1">{folders.length}</p>
          </div>
          <div className="rounded-lg border border-blue-100 p-3 bg-blue-50/70">
            <p className="text-xs text-blue-700/80 uppercase tracking-wide">Storage Used</p>
            <p className="text-2xl font-bold text-blue-950 mt-1">{formatBytes(totalSize)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <TbSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search file name, folder, or type"
                className="w-full border border-blue-200 rounded-md pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
              />
            </div>
            <select
              value={activeFolder}
              onChange={(event) => setActiveFolder(event.target.value)}
              className="border border-blue-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
            >
              <option value="All">All folders</option>
              {folders.map((folder) => (
                <option key={folder} value={folder}>{folder}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col md:flex-row gap-2 xl:justify-end">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="border border-blue-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
            >
              <option value="uploadedAt">Sort by upload date</option>
              <option value="name">Sort by file name</option>
              <option value="size">Sort by file size</option>
              <option value="folder">Sort by folder</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
              className="inline-flex items-center justify-center gap-2 border border-blue-200 rounded-md px-3 py-2 text-sm hover:bg-blue-50 transition text-blue-700"
            >
              {sortDirection === 'asc' ? <TbSortAscending2 size={18} /> : <TbSortDescending2 size={18} />}
              {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-4">
          {canManageVault && <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/60">
            <p className="text-sm font-semibold text-blue-900 mb-2">Create Folder</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={folderInput}
                onChange={(event) => setFolderInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleCreateFolder();
                  }
                }}
                placeholder="Folder name"
                className="flex-1 border border-blue-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                className="inline-flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-600 transition font-semibold"
              >
                <TbFolderPlus size={18} />
                Add
              </button>
            </div>
            <button
              type="button"
              onClick={handleDeleteFolder}
              className="mt-2 inline-flex items-center gap-2 border border-red-200 text-red-600 px-3 py-2 rounded-md text-sm hover:bg-red-50 transition font-medium"
            >
              <TbTrash size={16} />
              Delete Selected Folder
            </button>
            <p className="mt-2 text-xs text-blue-700/70">
              Only custom folders can be deleted. Files inside are moved to General.
            </p>
          </div>}

          {canManageVault && <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/60">
            <p className="text-sm font-semibold text-blue-900 mb-2">Upload Files</p>
            <div className="flex flex-col md:flex-row gap-2">
              <select
                value={selectedUploadFolder}
                onChange={(event) => setSelectedUploadFolder(event.target.value)}
                className="border border-blue-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
              >
                {folders.map((folder) => (
                  <option key={folder} value={folder}>{folder}</option>
                ))}
              </select>
              <label className="inline-flex items-center justify-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-md text-sm hover:bg-emerald-600 transition cursor-pointer font-semibold">
                <TbUpload size={18} />
                {isUploading ? 'Uploading...' : 'Choose files'}
                <input
                  type="file"
                  accept="*/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-blue-700/70">
              Supports all file types (PDF, TXT, images, videos, XLSX, DOCX, PPT, and more).
            </p>
          </div>}
        </div>

        {errorMessage && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-blue-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-blue-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-blue-950">Library</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-blue-700/70">{visibleFiles.length} result(s)</span>
            <button
              type="button"
              onClick={() => loadVaultData()}
              disabled={isLoading}
              className="inline-flex items-center gap-1 border border-blue-200 text-blue-700 rounded-md px-2 py-1 hover:bg-blue-50 transition text-xs font-medium disabled:opacity-50"
              title="Refresh Vault files"
            >
              <TbRefresh size={15} />
              Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-blue-700">Loading vault files...</div>
        ) : visibleFiles.length === 0 ? (
          <div className="p-8 text-center text-blue-700">
            <TbFolderOpen size={32} className="mx-auto mb-2 text-blue-300" />
            No files found. Upload files or adjust your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-100/70 text-blue-900 uppercase text-xs tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">File Name</th>
                  <th className="text-left px-4 py-3">Folder</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Size</th>
                  <th className="text-left px-4 py-3">Uploaded</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100">
                {visibleFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-blue-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{file.name}</td>
                    <td className="px-4 py-3">
                      {canManageVault ? (
                        <select
                          value={file.folder || ROOT_FOLDER}
                          onChange={(event) => handleMoveFile(file.id, event.target.value)}
                          className="border border-blue-200 rounded-md px-2 py-1 text-xs bg-white"
                        >
                          {folders.map((folder) => (
                            <option key={`${file.id}-${folder}`} value={folder}>{folder}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600">{file.folder || ROOT_FOLDER}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{file.mimeType || 'Unknown'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{formatBytes(file.size)}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {new Date(file.uploadedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenFile(file.id, 'view', file.name)}
                          className="inline-flex items-center gap-1 border border-blue-200 text-blue-700 rounded-md px-2 py-1 hover:bg-blue-50 transition text-xs font-medium"
                          title="View file"
                        >
                          <span className="hidden sm:inline">View</span>
                          <span className="sm:hidden">Open</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenFile(file.id, 'download', file.name)}
                          className="inline-flex items-center gap-1 border border-slate-300 text-slate-700 rounded-md px-2 py-1 hover:bg-slate-100 transition text-xs font-medium"
                          title="Download file"
                        >
                          <TbDownload size={16} />
                          <span className="hidden sm:inline">Download</span>
                        </button>
                        {canManageVault && <button
                          type="button"
                          onClick={() => handleDeleteFile(file.id)}
                          className="inline-flex items-center gap-1 border border-red-200 text-red-600 rounded-md px-2 py-1 hover:bg-red-50 transition text-xs font-medium"
                          title="Delete file"
                        >
                          <TbTrash size={16} />
                          <span className="hidden sm:inline">Delete</span>
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Vault;
