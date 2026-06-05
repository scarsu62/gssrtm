import React, { useState } from 'react';

function RequirementsTab({ projectId, requirements, refreshData, showAlert, apiKey, model }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Form fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Import fields
  const [uploadFile, setUploadFile] = useState(null);
  const [useAI, setUseAI] = useState(true);
  const [importing, setImporting] = useState(false);

  const handleOpenAdd = () => {
    setCode(`REQ-${String(requirements.length + 1).padStart(3, '0')}`);
    setName('');
    setDescription('');
    setEditingItem(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setDescription(item.description);
    setShowAddModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const url = editingItem
        ? `/api/projects/${projectId}/requirements/${editingItem.id}`
        : `/api/projects/${projectId}/requirements`;
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, description }),
      });

      if (!res.ok) throw new Error('Failed to save');
      
      showAlert('success', editingItem ? '需求已成功修改！' : '需求已成功建立！');
      setShowAddModal(false);
      refreshData();
    } catch (err) {
      showAlert('danger', '儲存失敗，請重試。');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除此需求項目嗎？這將會同步清除與其相關的所有追溯關聯！')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/requirements/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      showAlert('success', '需求項目已刪除');
      refreshData();
    } catch (err) {
      showAlert('danger', '刪除失敗。');
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('useAI', useAI);
      formData.append('model', model);

      const headers = {};
      if (apiKey) headers['x-gemini-key'] = apiKey;

      const res = await fetch(`/api/projects/${projectId}/requirements/import`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '匯入解析失敗');
      }

      const result = await res.json();
      showAlert('success', `匯入完成！新增 ${result.summary.created} 筆，修改 ${result.summary.updated} 筆，刪除 ${result.summary.deleted} 筆，未變更 ${result.summary.unchanged} 筆`);
      setShowImportModal(false);
      setUploadFile(null);
      refreshData();
    } catch (err) {
      console.error(err);
      showAlert('danger', err.message);
    } finally {
      setImporting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'new':
        return <span className="badge badge-new">新增</span>;
      case 'modified':
        return <span className="badge badge-modified">修改</span>;
      case 'deleted':
        return <span className="badge badge-deleted">已刪除</span>;
      default:
        return <span className="badge badge-unchanged">無變動</span>;
    }
  };

  return (
    <div className="glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>📋 系統需求清單</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-accent" onClick={() => setShowImportModal(true)}>
            📥 匯入客戶需求文件 (RFP)
          </button>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            ➕ 手動新增需求
          </button>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '100px' }}>需求編號</th>
              <th style={{ width: '220px' }}>需求名稱</th>
              <th>詳細內容描述</th>
              <th style={{ width: '80px' }}>版本</th>
              <th style={{ width: '90px' }}>異動狀態</th>
              <th style={{ width: '120px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {requirements.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  目前無需求資料。您可以點擊「匯入需求文件」上傳 Word (.docx) 或 Excel (.xlsx)，或點擊「手動新增」！
                </td>
              </tr>
            ) : (
              requirements.map((item) => (
                <tr key={item.id} style={{ opacity: item.status === 'deleted' ? 0.4 : 1 }}>
                  <td style={{ fontWeight: 'bold', color: 'var(--color-accent-cyan)' }}>
                    {item.status === 'deleted' ? <del>{item.code}</del> : item.code}
                  </td>
                  <td>
                    {item.status === 'deleted' ? <del>{item.name}</del> : item.name}
                  </td>
                  <td style={{ fontSize: '0.9rem', color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>
                    {item.status === 'deleted' ? <del>{item.description}</del> : item.description}
                  </td>
                  <td>v{item.version || '1.0.0'}</td>
                  <td>{getStatusBadge(item.status)}</td>
                  <td>
                    {item.status !== 'deleted' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-sm" onClick={() => handleOpenEdit(item)}>
                          📝
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>
                          🗑️
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingItem ? '📝 編輯需求項目' : '➕ 新增需求項目'}</h3>
              <button style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }} onClick={() => setShowAddModal(false)}>✖</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">需求編號</label>
                  <input type="text" className="form-control" value={code} onChange={(e) => setCode(e.target.value)} placeholder="例如：REQ-001" required />
                </div>
                <div className="form-group">
                  <label className="form-label">需求名稱</label>
                  <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：使用者註冊功能" required />
                </div>
                <div className="form-group">
                  <label className="form-label">需求詳細內容說明</label>
                  <textarea className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="詳細說明需求細節與驗證標準..." required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowAddModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">儲存變更</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>📥 匯入客戶需求文件 (RFP)</h3>
              <button style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }} onClick={() => setShowImportModal(false)}>✖</button>
            </div>
            <form onSubmit={handleImport}>
              <div className="modal-body">
                <div 
                  className="upload-dropzone"
                  onClick={() => document.getElementById('req-file-input').click()}
                  style={{ borderStyle: uploadFile ? 'solid' : 'dashed', borderColor: uploadFile ? 'var(--color-accent-cyan)' : '' }}
                >
                  <div className="upload-icon">📂</div>
                  <p>{uploadFile ? `已選擇檔案：${uploadFile.name}` : '點擊此處選擇要上傳的檔案'}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>支援 Word (.docx)、Excel (.xlsx/.xls) 與 純文字 (.txt)</p>
                  <input 
                    id="req-file-input" 
                    type="file" 
                    style={{ display: 'none' }} 
                    accept=".docx,.xlsx,.xls,.txt,.csv"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" 
                    id="use-ai-req" 
                    checked={useAI} 
                    onChange={(e) => setUseAI(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="use-ai-req" style={{ cursor: 'pointer', fontWeight: '500' }}>
                    使用 Gemini AI 進行內容非結構化拆解與結構化生成
                  </label>
                </div>
                {useAI && !apiKey && (
                  <p style={{ color: 'var(--status-modified)', fontSize: '0.8rem', marginTop: '-8px' }}>
                    ⚠️ 請注意：您尚未配置 API Key。如果您沒有設定後端環境變數，請至「系統設定」頁面填寫您的 API Key。
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowImportModal(false)} disabled={importing}>取消</button>
                <button type="submit" className="btn btn-primary" disabled={importing || !uploadFile}>
                  {importing ? '⏳ 解析並比對版本中...' : '開始匯入解析'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RequirementsTab;
