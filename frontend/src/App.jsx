import React, { useState, useEffect } from 'react';
import ProjectDashboard from './components/ProjectDashboard';
import Workspace from './components/Workspace';

function App() {
  const [currentProject, setCurrentProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error(err);
      triggerAlert('danger', '無法取得專案列表，請檢查後端服務是否已啟動。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleCreateProject = async (name, description) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error('Create project failed');
      const newProj = await res.json();
      triggerAlert('success', `成功建立專案：${newProj.name}`);
      await fetchProjects();
      setCurrentProject(newProj);
    } catch (err) {
      triggerAlert('danger', '建立專案失敗，請重試。');
    }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('確定要刪除此專案嗎？這將會永久刪除該專案下的需求、功能以及所有追溯關聯，且無法復原！')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete project failed');
      triggerAlert('success', '專案已成功刪除');
      fetchProjects();
      if (currentProject && currentProject.id === id) {
        setCurrentProject(null);
      }
    } catch (err) {
      triggerAlert('danger', '刪除專案失敗。');
    }
  };

  return (
    <div className="app-container">
      {/* Alert message container */}
      {alert && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1000, minWidth: '300px' }}>
          <div className={`alert alert-${alert.type === 'danger' ? 'error' : 'success'}`} style={{ boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            {alert.type === 'danger' ? '⚠️ ' : '✅ '}
            {alert.message}
          </div>
        </div>
      )}

      {currentProject ? (
        <Workspace 
          project={currentProject} 
          onBack={() => {
            setCurrentProject(null);
            fetchProjects();
          }}
          showAlert={triggerAlert}
        />
      ) : (
        <ProjectDashboard 
          projects={projects}
          loading={loading}
          onCreateProject={handleCreateProject}
          onSelectProject={setCurrentProject}
          onDeleteProject={handleDeleteProject}
        />
      )}
    </div>
  );
}

export default App;
