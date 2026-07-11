import client from './client';

export const listPaymentPlansForProject = (projectId) =>
  client.get(`/payments/project/${projectId}`).then((res) => res.data);
export const getPaymentPlan = (id) => client.get(`/payments/plan/${id}`).then((res) => res.data);
export const createPaymentPlan = (payload) => client.post('/payments/plans', payload).then((res) => res.data);
export const payMilestone = (id) => client.put(`/payments/milestones/${id}/pay`, {}).then((res) => res.data);
export const logUsagePeriod = (planId, payload) =>
  client.post(`/payments/plans/${planId}/usage`, payload).then((res) => res.data);
export const payUsagePeriod = (id) => client.put(`/payments/usage/${id}/pay`, {}).then((res) => res.data);
