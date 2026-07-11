import client from './client';

export const listProjects = () => client.get('/projects').then((res) => res.data);
export const getProject = (id) => client.get(`/projects/${id}`).then((res) => res.data);
export const createProject = (payload) => client.post('/projects', payload).then((res) => res.data);
export const updateProject = (id, payload) => client.put(`/projects/${id}`, payload).then((res) => res.data);
export const deleteProject = (id) => client.delete(`/projects/${id}`).then((res) => res.data);

export const addProjectEngineer = (projectId, payload) =>
  client.post(`/projects/${projectId}/engineers`, payload).then((res) => res.data);
export const updateProjectEngineer = (engineerId, payload) =>
  client.put(`/projects/engineers/${engineerId}`, payload).then((res) => res.data);
export const addProjectMaterial = (projectId, payload) =>
  client.post(`/projects/${projectId}/materials`, payload).then((res) => res.data);
export const addProjectCost = (projectId, payload) =>
  client.post(`/projects/${projectId}/costs`, payload).then((res) => res.data);

export const downloadProposalPdf = async (projectId) => {
  const response = await client.get(`/projects/${projectId}/proposal/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `proposal-${projectId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
