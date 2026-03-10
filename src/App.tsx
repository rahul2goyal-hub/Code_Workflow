/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Clock, 
  User as UserIcon, 
  LogOut, 
  ChevronRight,
  AlertCircle,
  FileUp,
  Search,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { User, UserRole, WorkflowStatus, WorkflowItem } from './types';
import { DUMMY_USERS } from './constants';

// --- Components ---

const Badge = ({ status }: { status: WorkflowStatus }) => {
  const colors: Record<WorkflowStatus, string> = {
    [WorkflowStatus.DRAFT]: 'bg-gray-100 text-gray-700 border-gray-200',
    [WorkflowStatus.PENDING_PMO]: 'bg-blue-100 text-blue-700 border-blue-200',
    [WorkflowStatus.PENDING_MLH_INITIAL]: 'bg-amber-100 text-amber-700 border-amber-200',
    [WorkflowStatus.PENDING_PL_DETAILS]: 'bg-purple-100 text-purple-700 border-purple-200',
    [WorkflowStatus.PENDING_MLH_FINAL]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    [WorkflowStatus.COMPLETED_RMT]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider ${colors[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<WorkflowItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // --- Initialization ---

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('workflow_updated', () => {
      fetchItems();
    });

    fetchItems();

    return () => {
      newSocket.close();
    };
  }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/workflow');
      const data = await res.json();
      setItems(data.map((d: any) => d.data));
    } catch (err) {
      console.error('Failed to fetch items', err);
    }
  };

  // --- Handlers ---

  const handleLogin = (username: string) => {
    const user = DUMMY_USERS.find(u => u.username === username);
    if (user) setCurrentUser(user);
  };

  const handleCreateIPC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let fileUrl = 'dummy_ipc_document.pdf';
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) throw new Error('Upload failed');
        const uploadData = await uploadRes.json();
        fileUrl = uploadData.url;
      }

      const newItem: WorkflowItem = {
        id: `IPC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        status: WorkflowStatus.PENDING_PMO,
        createdBy: currentUser.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ipcDocumentUrl: fileUrl,
        history: [{
          status: WorkflowStatus.PENDING_PMO,
          updatedBy: currentUser.id,
          timestamp: Date.now(),
          comment: 'IPC Created and forwarded to PMO'
        }]
      };

      const res = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newItem.id,
          status: newItem.status,
          createdBy: newItem.createdBy,
          data: newItem
        })
      });

      if (!res.ok) throw new Error('Failed to create workflow');

      setIsCreating(false);
      setSelectedFile(null);
      fetchItems();
    } catch (err) {
      console.error('Workflow creation failed', err);
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (itemId: string, nextStatus: WorkflowStatus, updatedData: Partial<WorkflowItem>) => {
    if (!currentUser || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const newItem: WorkflowItem = {
        ...item,
        ...updatedData,
        status: nextStatus,
        updatedAt: Date.now(),
        history: [
          ...item.history,
          {
            status: nextStatus,
            updatedBy: currentUser.id,
            timestamp: Date.now()
          }
        ]
      };

      const res = await fetch(`/api/workflow/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          data: newItem
        })
      });

      if (!res.ok) throw new Error('Failed to update workflow');

      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      console.error('Workflow update failed', err);
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Filtered Items ---

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.modelName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  // --- Renderers ---

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-black/5"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <LayoutDashboard className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">NPD Workflow</h1>
            <p className="text-gray-500 text-sm">Select a role to continue</p>
          </div>

          <div className="space-y-3">
            {DUMMY_USERS.map(user => (
              <button
                key={user.id}
                onClick={() => handleLogin(user.username)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-transparent hover:border-black/10 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-black/5 flex items-center justify-center font-bold text-gray-700">
                    {user.role}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">{user.role}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-900 transition-colors" />
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#141414] text-white flex flex-col border-r border-black">
        <div className="p-6 border-bottom border-white/10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <LayoutDashboard className="text-black w-5 h-5" />
            </div>
            <span className="font-bold tracking-tight">NPD PRO</span>
          </div>

          <nav className="space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 rounded-lg text-sm font-medium">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{currentUser.name}</p>
              <p className="text-[10px] uppercase tracking-widest opacity-50">{currentUser.role}</p>
            </div>
          </div>
          <button 
            onClick={() => setCurrentUser(null)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-black/5 flex items-center justify-between px-8">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">
            {isCreating ? 'Create New IPC' : selectedItem ? `Workflow: ${selectedItem.id}` : 'Active Workflows'}
          </h2>
          
          {!isCreating && !selectedItem && currentUser.role === UserRole.PL && (
            <button 
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Start New IPC
            </button>
          )}
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {isCreating ? (
              <motion.div 
                key="create"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-black/5 shadow-xl"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <FileUp className="text-gray-600 w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Initiate New Project</h3>
                    <p className="text-sm text-gray-500">Upload IPC document to begin the workflow</p>
                  </div>
                </div>

                <form onSubmit={handleCreateIPC} className="space-y-6">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                      selectedFile ? 'border-black bg-gray-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <FileText className={`w-12 h-12 mb-4 ${selectedFile ? 'text-black' : 'text-gray-300'}`} />
                    <p className="text-sm font-medium text-gray-600">
                      {selectedFile ? `Selected: ${selectedFile.name}` : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PDF (MAX. 10MB)</p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setSelectedFile(null);
                      }}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit to PMO'}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : selectedItem ? (
              <WorkflowDetail 
                item={selectedItem} 
                currentUser={currentUser} 
                isSubmitting={isSubmitting}
                onBack={() => setSelectedItem(null)}
                onUpdate={handleUpdateStatus}
              />
            ) : (
              <motion.div 
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {/* Search & Filter */}
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search by ID or Model Name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-black/5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                    />
                  </div>
                  <button className="px-4 py-3 bg-white border border-black/5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-50">
                    <Filter className="w-4 h-4" />
                    Filters
                  </button>
                </div>

                {/* Data Grid */}
                <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[1fr_2fr_1.5fr_1.5fr_1fr] px-6 py-4 bg-gray-50 border-b border-black/5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    <div>ID</div>
                    <div>Model / Archetype</div>
                    <div>Status</div>
                    <div>Updated</div>
                    <div className="text-right">Action</div>
                  </div>
                  <div className="divide-y divide-black/5">
                    {filteredItems.length === 0 ? (
                      <div className="p-12 text-center">
                        <Clock className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">No active workflows found</p>
                      </div>
                    ) : (
                      filteredItems.map(item => (
                        <div 
                          key={item.id}
                          className="grid grid-cols-[1fr_2fr_1.5fr_1.5fr_1fr] px-6 py-5 hover:bg-gray-50 transition-colors cursor-pointer items-center"
                          onClick={() => setSelectedItem(item)}
                        >
                          <div className="font-mono text-xs font-bold text-gray-900">{item.id}</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{item.modelName || '---'}</p>
                            <p className="text-xs text-gray-500 italic">{item.archetype || 'Pending PMO details'}</p>
                          </div>
                          <div>
                            <Badge status={item.status} />
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(item.updatedAt).toLocaleString()}
                          </div>
                          <div className="text-right">
                            <button className="text-xs font-bold text-black hover:underline">View Details</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- Detail View Component ---

function WorkflowDetail({ 
  item, 
  currentUser, 
  isSubmitting,
  onBack, 
  onUpdate 
}: { 
  item: WorkflowItem; 
  currentUser: User; 
  isSubmitting: boolean;
  onBack: () => void;
  onUpdate: (id: string, next: WorkflowStatus, data: Partial<WorkflowItem>) => void;
}) {
  const [formData, setFormData] = useState<Partial<WorkflowItem>>(item);

  const canAction = useMemo(() => {
    if (item.status === WorkflowStatus.PENDING_PMO && currentUser.role === UserRole.PMO) return true;
    if (item.status === WorkflowStatus.PENDING_MLH_INITIAL && currentUser.role === UserRole.MLH) return true;
    if (item.status === WorkflowStatus.PENDING_PL_DETAILS && currentUser.role === UserRole.PL) return true;
    if (item.status === WorkflowStatus.PENDING_MLH_FINAL && currentUser.role === UserRole.MLH) return true;
    return false;
  }, [item.status, currentUser.role]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let nextStatus = item.status;

    if (item.status === WorkflowStatus.PENDING_PMO) nextStatus = WorkflowStatus.PENDING_MLH_INITIAL;
    else if (item.status === WorkflowStatus.PENDING_MLH_INITIAL) nextStatus = WorkflowStatus.PENDING_PL_DETAILS;
    else if (item.status === WorkflowStatus.PENDING_PL_DETAILS) nextStatus = WorkflowStatus.PENDING_MLH_FINAL;
    else if (item.status === WorkflowStatus.PENDING_MLH_FINAL) nextStatus = WorkflowStatus.COMPLETED_RMT;

    onUpdate(item.id, nextStatus, formData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8"
    >
      <div className="lg:col-span-2 space-y-8">
        {/* Main Form/Info */}
        <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <button onClick={onBack} className="text-xs font-bold text-gray-400 hover:text-black flex items-center gap-1">
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to Dashboard
            </button>
            <Badge status={item.status} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* PMO Section */}
            {(item.status === WorkflowStatus.PENDING_PMO || item.modelName) && (
              <section className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-black/5 pb-2">Project Definition (PMO)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Model Name</label>
                    <input 
                      disabled={item.status !== WorkflowStatus.PENDING_PMO}
                      required
                      value={formData.modelName || ''}
                      onChange={e => setFormData({ ...formData, modelName: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Archetype</label>
                    <input 
                      disabled={item.status !== WorkflowStatus.PENDING_PMO}
                      required
                      value={formData.archetype || ''}
                      onChange={e => setFormData({ ...formData, archetype: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Part of CP</label>
                    <select 
                      disabled={item.status !== WorkflowStatus.PENDING_PMO}
                      value={formData.partOfCP ? 'yes' : 'no'}
                      onChange={e => setFormData({ ...formData, partOfCP: e.target.value === 'yes' })}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Flow Type</label>
                    <select 
                      disabled={item.status !== WorkflowStatus.PENDING_PMO}
                      value={formData.flowType || 'R'}
                      onChange={e => setFormData({ ...formData, flowType: e.target.value as 'R' | 'D' })}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                    >
                      <option value="R">R Flow</option>
                      <option value="D">D Flow</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Assign MLH</label>
                    <select 
                      disabled={item.status !== WorkflowStatus.PENDING_PMO}
                      required
                      value={formData.assignedMLH || ''}
                      onChange={e => setFormData({ ...formData, assignedMLH: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                    >
                      <option value="">Select MLH...</option>
                      {DUMMY_USERS.filter(u => u.role === UserRole.MLH).map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">SOP Date</label>
                    <input 
                      type="date"
                      disabled={item.status !== WorkflowStatus.PENDING_PMO}
                      required
                      value={formData.sopDate || ''}
                      onChange={e => setFormData({ ...formData, sopDate: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* MLH Initial Section */}
            {(item.status === WorkflowStatus.PENDING_MLH_INITIAL || item.assignedPL) && (
              <section className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-black/5 pb-2">Module Lead Assignment (MLH)</h4>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500">Assign PL</label>
                  <select 
                    disabled={item.status !== WorkflowStatus.PENDING_MLH_INITIAL}
                    required
                    value={formData.assignedPL || ''}
                    onChange={e => setFormData({ ...formData, assignedPL: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                  >
                    <option value="">Select PL...</option>
                    {DUMMY_USERS.filter(u => u.role === UserRole.PL).map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </section>
            )}

            {/* PL Details Section */}
            {(item.status === WorkflowStatus.PENDING_PL_DETAILS || item.newModelBaseModel) && (
              <section className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-black/5 pb-2">Technical Details (PL)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">New Model Base Model</label>
                    <input 
                      disabled={item.status !== WorkflowStatus.PENDING_PL_DETAILS}
                      required
                      value={formData.newModelBaseModel || ''}
                      onChange={e => setFormData({ ...formData, newModelBaseModel: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Base Model Change</label>
                    <input 
                      disabled={item.status !== WorkflowStatus.PENDING_PL_DETAILS}
                      required
                      value={formData.baseModelChange || ''}
                      onChange={e => setFormData({ ...formData, baseModelChange: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">New Model Change</label>
                    <input 
                      disabled={item.status !== WorkflowStatus.PENDING_PL_DETAILS}
                      required
                      value={formData.newModelChange || ''}
                      onChange={e => setFormData({ ...formData, newModelChange: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Projected Completion Date</label>
                    <input 
                      type="date"
                      disabled={item.status !== WorkflowStatus.PENDING_PL_DETAILS}
                      required
                      value={formData.actualCompletionDate || ''}
                      onChange={e => setFormData({ ...formData, actualCompletionDate: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Market Type</label>
                    <select 
                      disabled={item.status !== WorkflowStatus.PENDING_PL_DETAILS}
                      value={formData.marketType || 'GB'}
                      onChange={e => setFormData({ ...formData, marketType: e.target.value as 'GB' | 'D' })}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                    >
                      <option value="GB">GB</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Base Model Market Type</label>
                    <input 
                      disabled={item.status !== WorkflowStatus.PENDING_PL_DETAILS}
                      required
                      value={formData.baseModelMarketType || ''}
                      onChange={e => setFormData({ ...formData, baseModelMarketType: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-lg text-sm disabled:opacity-50"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* MLH Final Approval Section */}
            {item.status === WorkflowStatus.PENDING_MLH_FINAL && (
              <section className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-black/5 pb-2">Final Approval (MLH)</h4>
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
                  <AlertCircle className="text-indigo-500 w-5 h-5" />
                  <p className="text-sm text-indigo-700">Please review all technical details before final approval to RMT.</p>
                </div>
              </section>
            )}

            {canAction && (
              <div className="pt-8 border-t border-black/5 flex gap-3">
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {isSubmitting ? 'Processing...' : (item.status === WorkflowStatus.PENDING_MLH_FINAL ? 'Approve & Forward to RMT' : 'Approve & Forward')}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Sidebar Info */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Project Assets</h4>
          <a 
            href={item.ipcDocumentUrl.startsWith('http') ? item.ipcDocumentUrl : `${window.location.origin}${item.ipcDocumentUrl}`} 
            target="_blank" 
            rel="noopener noreferrer"
            download
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-black/5 group cursor-pointer hover:bg-gray-100 transition-colors w-full text-left"
          >
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <FileText className="text-red-500 w-5 h-5" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate">{item.ipcDocumentUrl?.split('/').pop() || 'IPC_Document.pdf'}</p>
              <p className="text-[10px] text-gray-400">PDF Document</p>
            </div>
          </a>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Workflow History</h4>
          <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-100">
            {item.history.map((log, idx) => (
              <div key={idx} className="relative pl-8">
                <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                  idx === item.history.length - 1 ? 'bg-black' : 'bg-gray-200'
                }`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
                <p className="text-xs font-bold text-gray-900 mt-0.5">
                  {log.status.replace(/_/g, ' ')}
                </p>
                <p className="text-[10px] text-gray-500">
                  By {DUMMY_USERS.find(u => u.id === log.updatedBy)?.name || 'System'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
