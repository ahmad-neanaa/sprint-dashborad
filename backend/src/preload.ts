const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getBurndown: (args: any) => ipcRenderer.invoke('api:getBurndown', args),
  getVelocity: (args: any) => ipcRenderer.invoke('api:getVelocity', args),
  getTeam: (args: any) => ipcRenderer.invoke('api:getTeam', args),
  getCommitmentAssignee: (args: any) => ipcRenderer.invoke('api:getCommitmentAssignee', args),
  getKpiReview: (args: any) => ipcRenderer.invoke('api:getKpiReview', args),
  getStability: (args: any) => ipcRenderer.invoke('api:getStability', args),
  getScorecard: (args: any) => ipcRenderer.invoke('api:getScorecard', args),
  getDefects: (args: any) => ipcRenderer.invoke('api:getDefects', args),
  getCommitment: (args: any) => ipcRenderer.invoke('api:getCommitment', args),
  getCycleTime: (args: any) => ipcRenderer.invoke('api:getCycleTime', args),
  getTimeAnalysis: (args: any) => ipcRenderer.invoke('api:getTimeAnalysis', args),
  getOverview: (args: any) => ipcRenderer.invoke('api:getOverview', args),
  getTimesheet: (args: any) => ipcRenderer.invoke('api:getTimesheet', args),
  getSprints: (args: any) => ipcRenderer.invoke('api:getSprints', args),
  getIssueTypes: (args: any) => ipcRenderer.invoke('api:getIssueTypes', args),
  getProjects: () => ipcRenderer.invoke('api:getProjects'),
  createProject: (args: any) => ipcRenderer.invoke('api:createProject', args),
  updateProject: (args: any) => ipcRenderer.invoke('api:updateProject', args),
  deleteProject: (args: any) => ipcRenderer.invoke('api:deleteProject', args),
  getConfig: () => ipcRenderer.invoke('api:getConfig'),
  updateConfig: (args: any) => ipcRenderer.invoke('api:updateConfig', args),
  putConfig: (args: any) => ipcRenderer.invoke('api:putConfig', args),
  refreshData: (args: any) => ipcRenderer.invoke('api:refreshData', args)
})
