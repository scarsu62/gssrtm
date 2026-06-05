import React, { useState } from 'react';

function ProjectDashboard({ projects, loading, onCreateProject, onSelectProject, onDeleteProject }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateProject(name, description);
    setName('');
    setDescription('');
    setShowCreateModal(false);
  };

  return (
    <div>
      <div className="app-header">
        <div className="logo-container">
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #8e2de2, #4a00e0)', borderRadius: '10px', boxShadow: '0 0 15px rgba(142,45,226,0.5)' }}></div>
          <span className="logo-text">RTM Matrix</span>
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            ➕ 建立新專案
          </button>
        </div>
      </div>

      <div className="glass-panel">
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          📁 專案列表
        </h2>
        
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>載入中...</p>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>尚無任何專案。請點擊上方按鈕建立新專案以開始您的需求追溯管理！</p>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              立即建立新專案
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {projects.map((proj) => (
              <div 
                key={proj.id} 
                className="glass-panel" 
                style={{ 
                  margin: 0, 
                  padding: '1.5rem', 
                  background: 'rgba(255,255,255,0.02)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between', 
                  height: '240px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}
              >
                <div>
                  <h3 style={{ color: 'var(--color-accent-cyan)', marginBottom: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {proj.name}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', height: '60px', lineHeight: '1.4' }}>
                    {proj.description || '沒有專案描述說明。'}
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>建立於: {new Date(proj.createdAt).toLocaleDateString()}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-accent btn-sm" onClick={() => onSelectProject(proj)}>
                      進入專案 🚀
                    </button>
                    <button className="btn btn-danger btn-sm" style={{ padding: '6px 10px' }} onClick={(e) => { e.stopPropagation(); onDeleteProject(proj.id); }}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>🆕 建立新專案</h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }} onClick={() => setShowCreateModal(false)}>
                ✖
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">專案名稱</label>
                  <input type="text" className="form-control" placeholder="例如：智慧物流系統、RTM 平台二期..." value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">專案描述</label>
                  <textarea className="form-control" placeholder="輸入此專案的簡介、目的或客戶名稱..." value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  確認建立
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectDashboard;
