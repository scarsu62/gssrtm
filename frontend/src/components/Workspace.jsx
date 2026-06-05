import React, { useState, useEffect } from 'react';
import RequirementsTab from './RequirementsTab';
import FunctionsTab from './FunctionsTab';
import MatrixTab from './MatrixTab';
import TraceabilityTab from './TraceabilityTab';
import SettingsTab from './SettingsTab';

function Workspace({ project, onBack, showAlert }) {
  const [activeTab, setActiveTab] = useState('requirements');
  const [requirements, setRequirements] = useState([]);
  const [functions, setFunctions] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load API settings from localStorage
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('rtm_gemini_key') || '');
  const [model, setModel] = useState(() => localStorage.getItem('rtm_gemini_model') || 'gemini-3.5-flash');

  const refreshData = async () => {
    try {
      setLoading(true);
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['x-gemini-key'] = apiKey;

      const [resReq, resFun, resMap] = await Promise.all([
        fetch(`/api/projects/${project.id}/requirements`),
        fetch(`/api/projects/${project.id}/functions`),
        fetch(`/api/projects/${project.id}/mappings`, { headers })
      ]);

      if (!resReq.ok || !resFun.ok || !resMap.ok) throw new Error('Failed to load project data');

      const dataReq = await resReq.json();
      const dataFun = await resFun.json();
      const dataMap = await resMap.json();

      setRequirements(dataReq);
      setFunctions(dataFun);
      setMappings(dataMap);
    } catch (err) {
      console.error(err);
      showAlert('danger', '讀取專案資料失敗，請檢查後端服務是否正常。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [project.id]);

  const handleSaveSettings = (key, mdl) => {
    localStorage.setItem('rtm_gemini_key', key);
    localStorage.setItem('rtm_gemini_model', mdl);
    setApiKey(key);
    setModel(mdl);
    showAlert('success', '系統設定已成功儲存！');
  };

  return (
    <div>
      <div className="app-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-sm" onClick={onBack}>
            ⬅️ 返回列表
          </button>
          <div>
            <h2 style={{ color: 'var(--color-accent-cyan)', fontSize: '1.6rem' }}>{project.name}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>{project.description || '無描述'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {loading && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>🔄 同步中...</span>}
          <button className="btn btn-sm btn-primary" onClick={refreshData}>
            🔄 重新整理
          </button>
        </div>
      </div>

      <div className="tab-navigation">
        <button className={`tab-btn ${activeTab === 'requirements' ? 'active' : ''}`} onClick={() => setActiveTab('requirements')}>
          📋 需求清單 ({requirements.filter(r => r.status !== 'deleted').length})
        </button>
        <button className={`tab-btn ${activeTab === 'functions' ? 'active' : ''}`} onClick={() => setActiveTab('functions')}>
          ⚙️ 功能清單 ({functions.filter(f => f.status !== 'deleted').length})
        </button>
        <button className={`tab-btn ${activeTab === 'matrix' ? 'active' : ''}`} onClick={() => setActiveTab('matrix')}>
          🔲 關聯矩陣
        </button>
        <button className={`tab-btn ${activeTab === 'traceability' ? 'active' : ''}`} onClick={() => setActiveTab('traceability')}>
          🔗 追溯清單與變更分析
        </button>
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          🛠️ 系統設定
        </button>
      </div>

      {activeTab === 'requirements' && (
        <RequirementsTab 
          projectId={project.id} 
          requirements={requirements} 
          refreshData={refreshData} 
          showAlert={showAlert}
          apiKey={apiKey}
          model={model}
        />
      )}

      {activeTab === 'functions' && (
        <FunctionsTab 
          projectId={project.id} 
          functions={functions} 
          refreshData={refreshData} 
          showAlert={showAlert}
          apiKey={apiKey}
          model={model}
        />
      )}

      {activeTab === 'matrix' && (
        <MatrixTab 
          projectId={project.id} 
          requirements={requirements.filter(r => r.status !== 'deleted')} 
          functions={functions.filter(f => f.status !== 'deleted')} 
          mappings={mappings} 
          refreshData={refreshData} 
          showAlert={showAlert}
        />
      )}

      {activeTab === 'traceability' && (
        <TraceabilityTab 
          projectId={project.id} 
          requirements={requirements} 
          functions={functions} 
          mappings={mappings} 
          refreshData={refreshData} 
          showAlert={showAlert}
          apiKey={apiKey}
          model={model}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab 
          initialApiKey={apiKey}
          initialModel={model}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
}

export default Workspace;
