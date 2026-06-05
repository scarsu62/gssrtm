import React from 'react';

function MatrixTab({ projectId, requirements, functions, mappings, refreshData, showAlert }) {
  
  // Map key string `reqId_funId` -> mapping object
  const mappingMap = new Map(mappings.map(m => [`${m.requirementId}_${m.functionId}`, m]));

  const handleCellClick = async (reqId, funId) => {
    const key = `${reqId}_${funId}`;
    const existing = mappingMap.get(key);
    
    // Toggle active state
    const isActive = !existing;
    try {
      const res = await fetch(`/api/projects/${projectId}/mappings/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirementId: reqId, functionId: funId, active: isActive }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      refreshData();
    } catch (err) {
      showAlert('danger', '更新追溯關聯失敗。');
    }
  };

  const getCellStatus = (reqId, funId) => {
    const key = `${reqId}_${funId}`;
    const m = mappingMap.get(key);
    if (!m) return null;
    return m.status; // 'confirmed', 'ai_recommended', 'pending'
  };

  return (
    <div className="glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h3>🔲 需求追溯關係矩陣 (RTM Matrix Grid)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            點擊矩陣中的交叉單元格，即可手動建立或切斷需求與功能之間的連結。
          </p>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '20px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="matrix-dot confirmed" style={{ width: '14px', height: '14px', boxShadow: 'none' }}></div>
            <span>手動確認/已儲存</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="matrix-dot ai_recommended" style={{ width: '14px', height: '14px', animation: 'none', position: 'relative', borderStyle: 'dashed' }}>
              <div style={{ position: 'absolute', top: '3px', left: '3px', width: '4px', height: '4px', background: 'var(--color-accent-cyan)', borderRadius: '50%' }}></div>
            </div>
            <span>AI 推薦關聯</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="matrix-dot pending" style={{ width: '14px', height: '14px', animation: 'none' }}></div>
            <span>待確認警示 (變更影響)</span>
          </div>
        </div>
      </div>

      {requirements.length === 0 || functions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          ⚠️ 系統需要同時具備「需求清單」與「功能清單」才能繪製追溯矩陣。請先到對應頁面新增或匯入檔案。
        </div>
      ) : (
        <div className="matrix-container">
          <table className="matrix-table">
            <thead>
              <tr>
                {/* Top-Left empty sticky corner */}
                <th className="sticky-top-left" style={{ minWidth: '250px', textAlign: 'left', background: 'rgba(20, 15, 45, 0.95)' }}>
                  需求項目 (列) \ 功能項目 (欄)
                </th>
                {functions.map((fun) => (
                  <th key={fun.id} className="sticky-top" style={{ width: '60px', background: 'rgba(20, 15, 45, 0.95)' }} title={`${fun.code}: ${fun.name}`}>
                    <div className="vertical-header-text">
                      {fun.code}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requirements.map((req) => (
                <tr key={req.id}>
                  {/* Sticky left row label */}
                  <td className="sticky-left" style={{ background: 'rgba(20, 15, 45, 0.95)' }} title={`${req.code}: ${req.name}`}>
                    <span style={{ color: 'var(--color-accent-cyan)', fontWeight: 'bold' }}>{req.code}</span>
                    <span style={{ marginLeft: '8px', fontSize: '0.85rem' }}>{req.name}</span>
                  </td>
                  {/* Intersection cells */}
                  {functions.map((fun) => {
                    const status = getCellStatus(req.id, fun.id);
                    return (
                      <td 
                        key={fun.id} 
                        className="matrix-cell" 
                        onClick={() => handleCellClick(req.id, fun.id)}
                        title={`需求編號: ${req.code} ${req.name}\n功能編號: ${fun.code} ${fun.name}\n追溯狀態: ${
                          status === 'confirmed' ? '已確認' : 
                          status === 'ai_recommended' ? 'AI 推薦（點擊以確認）' : 
                          status === 'pending' ? '警示！需求/功能內容已修改，待重新確認' : '無關聯'
                        }`}
                      >
                        <div className={`matrix-dot ${status || ''}`}></div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MatrixTab;
