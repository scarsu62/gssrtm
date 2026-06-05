import React, { useState } from 'react';

function TraceabilityTab({ projectId, requirements, functions, mappings, refreshData, showAlert, apiKey, model }) {
  const [runningAI, setRunningAI] = useState(false);
  const [targetReqId, setTargetReqId] = useState(null); // tracking single AI runs

  // Filter out deleted requirements/functions for list display
  const activeReqs = requirements.filter(r => r.status !== 'deleted');
  const activeFuns = functions.filter(f => f.status !== 'deleted');
  const funMap = new Map(activeFuns.map(f => [f.id, f]));

  // Group mappings by requirementId
  const mappingsByReq = new Map();
  for (const m of mappings) {
    // skip mappings to functions that are deleted
    if (!funMap.has(m.functionId)) continue;
    if (!mappingsByReq.has(m.requirementId)) {
      mappingsByReq.set(m.requirementId, []);
    }
    mappingsByReq.get(m.requirementId).push(m);
  }

  // Count total warnings
  let warningCount = 0;
  for (const req of activeReqs) {
    const reqMaps = mappingsByReq.get(req.id) || [];
    const hasPending = reqMaps.some(m => m.status === 'pending');
    if (req.status === 'modified' || hasPending) {
      warningCount++;
    }
  }

  const handleConfirmMapping = async (mappingId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/mappings/${mappingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      if (!res.ok) throw new Error('Confirm mapping failed');
      refreshData();
      showAlert('success', '關聯已確認！');
    } catch (err) {
      showAlert('danger', '確認關聯失敗。');
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/mappings/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirementId: mappings.find(m => m.id === mappingId).requirementId,
          functionId: mappings.find(m => m.id === mappingId).functionId,
          active: false
        }),
      });
      if (!res.ok) throw new Error('Delete mapping failed');
      refreshData();
      showAlert('success', '關聯已解除');
    } catch (err) {
      showAlert('danger', '解除關聯失敗。');
    }
  };

  const handleRunAllAI = async () => {
    if (!apiKey) {
      showAlert('danger', '請先在「系統設定」中配置您的 Gemini API Key！');
      return;
    }
    if (!window.confirm('確定要執行 AI 全自動需求對齊嗎？這將會耗用 API 額度，並分析所有需求與功能的關聯。')) return;

    try {
      setRunningAI(true);
      const res = await fetch(`/api/projects/${projectId}/mappings/ai-align`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-key': apiKey
        },
        body: JSON.stringify({ model }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'AI 對齊失敗');
      }

      const result = await res.json();
      showAlert('success', `AI 對齊完成！推薦了 ${result.totalRecommended} 筆需求對齊關聯。`);
      refreshData();
    } catch (err) {
      showAlert('danger', err.message);
    } finally {
      setRunningAI(false);
    }
  };

  const handleRunSingleAI = async (reqId) => {
    if (!apiKey) {
      showAlert('danger', '請先在「系統設定」中配置您的 Gemini API Key！');
      return;
    }
    try {
      setTargetReqId(reqId);
      const res = await fetch(`/api/projects/${projectId}/mappings/ai-align`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-key': apiKey
        },
        body: JSON.stringify({ model, requirementId: reqId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'AI 推薦關聯失敗');
      }

      const result = await res.json();
      if (result.totalRecommended === 0) {
        showAlert('success', 'AI 評估完成，但未發現合適的功能對齊推薦。');
      } else {
        showAlert('success', `AI 推薦成功！已推薦 ${result.totalRecommended} 筆相關功能關聯。`);
      }
      refreshData();
    } catch (err) {
      showAlert('danger', err.message);
    } finally {
      setTargetReqId(null);
    }
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    try {
      let csvContent = '\uFEFF'; // UTF-8 BOM to prevent Excel garbled text (Big5 encoding issue)
      csvContent += '需求編號,需求名稱,需求描述,異動狀態,滿足該需求的功能項目(代號),功能名稱,追溯狀態,關聯說明\n';

      activeReqs.forEach(req => {
        const reqMaps = mappingsByReq.get(req.id) || [];
        if (reqMaps.length === 0) {
          // Orphan Requirement
          csvContent += `"${req.code}","${req.name.replace(/"/g, '""')}","${req.description.replace(/"/g, '""')}","${req.status}","未匹配功能","","未對齊",""\n`;
        } else {
          reqMaps.forEach(m => {
            const fun = funMap.get(m.functionId);
            const statusLabel = 
              m.status === 'confirmed' ? '已確認' : 
              m.status === 'ai_recommended' ? 'AI推薦待確認' : '待重新確認(異動影響)';
            csvContent += `"${req.code}","${req.name.replace(/"/g, '""')}","${req.description.replace(/"/g, '""')}","${req.status}","${fun.code}","${fun.name.replace(/"/g, '""')}","${statusLabel}","${m.reason.replace(/"/g, '""')}"\n`;
          });
        }
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `RTM_Traceability_Report_${projectId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showAlert('success', '需求追溯表已成功匯出為 CSV 檔！');
    } catch (err) {
      showAlert('danger', '匯出失敗，發生錯誤。');
    }
  };

  return (
    <div>
      {/* Change impact alert banner */}
      {warningCount > 0 && (
        <div className="impact-banner">
          <div>⚠️</div>
          <div>
            <strong>變更影響警示：</strong>
            專案中有 {warningCount} 個需求項目或其追溯關係，受到需求異動或功能修改的影響。
            請檢查下方標記為「<strong>待確認</strong>」或「<strong>修改</strong>」的項目並重新核實。
          </div>
        </div>
      )}

      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3>🔗 需求與功能滿足追溯清單</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              此清單呈現了每一個客戶需求項目被哪些功能所滿足，並提供 AI 自動化對齊工具。
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn" onClick={handleExportCSV}>
              📥 匯出需求追溯表 (CSV)
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleRunAllAI}
              disabled={runningAI}
            >
              {runningAI ? '⏳ AI 正在全自動對齊中...' : '🤖 執行 AI 全自動對齊'}
            </button>
          </div>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>客戶需求項目</th>
                <th style={{ width: '220px' }}>滿足功能項目</th>
                <th style={{ width: '130px' }}>關聯狀態</th>
                <th>關聯理由 / 滿足理由</th>
                <th style={{ width: '160px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {activeReqs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    目前無需求項目。請先至「需求清單」新增需求。
                  </td>
                </tr>
              ) : (
                activeReqs.map((req) => {
                  const reqMaps = mappingsByReq.get(req.id) || [];
                  const isModified = req.status === 'modified';
                  
                  return (
                    <React.Fragment key={req.id}>
                      {reqMaps.length === 0 ? (
                        /* Orphan requirement layout */
                        <tr style={{ background: isModified ? 'rgba(255, 145, 0, 0.04)' : '' }}>
                          <td>
                            <strong style={{ color: 'var(--color-accent-cyan)' }}>{req.code}</strong>
                            <div style={{ fontSize: '0.85rem', fontWeight: '500', marginTop: '4px' }}>{req.name}</div>
                            {isModified && <span className="badge badge-modified" style={{ marginTop: '6px' }}>修改</span>}
                          </td>
                          <td colSpan="3" style={{ color: 'var(--status-deleted)', fontStyle: 'italic', verticalAlign: 'middle', fontWeight: '500' }}>
                            ⚠️ 此項目目前無任何開發功能對應（孤立需求項目，請儘速指派功能）
                          </td>
                          <td style={{ verticalAlign: 'middle' }}>
                            <button 
                              className="btn btn-sm btn-accent" 
                              onClick={() => handleRunSingleAI(req.id)}
                              disabled={targetReqId === req.id}
                            >
                              {targetReqId === req.id ? '⏳ 尋找中...' : '🤖 AI 推薦對齊'}
                            </button>
                          </td>
                        </tr>
                      ) : (
                        /* Mapped requirements layout */
                        reqMaps.map((m, idx) => {
                          const fun = funMap.get(m.functionId);
                          const isFirst = idx === 0;
                          
                          // Style based on status
                          let statusLabel = '';
                          let statusClass = '';
                          if (m.status === 'confirmed') {
                            statusLabel = '✅ 已確認';
                            statusClass = 'badge-new'; // reuse green styles
                          } else if (m.status === 'ai_recommended') {
                            statusLabel = '🤖 AI 推薦';
                            statusClass = 'badge-unchanged'; // blue/indigo styles
                          } else {
                            statusLabel = '⚠️ 待確認';
                            statusClass = 'badge-modified'; // amber warning
                          }

                          return (
                            <tr key={m.id} style={{ 
                              background: m.status === 'pending' || isModified ? 'rgba(255, 145, 0, 0.03)' : '',
                              borderLeft: m.status === 'pending' ? '4px solid var(--status-modified)' : ''
                            }}>
                              {isFirst ? (
                                <td rowSpan={reqMaps.length} style={{ borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                                  <strong style={{ color: 'var(--color-accent-cyan)' }}>{req.code}</strong>
                                  <div style={{ fontSize: '0.85rem', fontWeight: '500', marginTop: '4px' }}>{req.name}</div>
                                  {isModified && <span className="badge badge-modified" style={{ marginTop: '6px' }}>修改</span>}
                                  <div style={{ marginTop: '10px' }}>
                                    <button 
                                      className="btn btn-sm" 
                                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                      onClick={() => handleRunSingleAI(req.id)}
                                      disabled={targetReqId === req.id}
                                    >
                                      {targetReqId === req.id ? '⏳ 推薦中...' : '🤖 AI 重新推薦'}
                                    </button>
                                  </div>
                                </td>
                              ) : null}
                              <td>
                                <strong style={{ color: 'var(--color-accent-pink)' }}>{fun.code}</strong>
                                <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>{fun.name}</div>
                              </td>
                              <td>
                                <span className={`badge ${statusClass}`}>{statusLabel}</span>
                                {m.confidence && m.status === 'ai_recommended' && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    信心度: {Math.round(m.confidence * 100)}%
                                  </div>
                                )}
                              </td>
                              <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>
                                {m.reason || '無說明描述。'}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {m.status !== 'confirmed' && (
                                    <button 
                                      className="btn btn-sm btn-primary" 
                                      style={{ padding: '6px 8px', fontSize: '0.75rem' }}
                                      onClick={() => handleConfirmMapping(m.id)}
                                      title="確認關聯無誤"
                                    >
                                      確認 ✔
                                    </button>
                                  )}
                                  <button 
                                    className="btn btn-sm btn-danger" 
                                    style={{ padding: '6px 8px', fontSize: '0.75rem' }}
                                    onClick={() => handleDeleteMapping(m.id)}
                                    title="解除此關聯"
                                  >
                                    解除 ✖
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TraceabilityTab;
