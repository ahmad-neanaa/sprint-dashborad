import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/burndown',
    },
    {
      path: '/burndown',
      name: 'Burndown',
      component: () => import('@/views/BurndownView.vue'),
    },
    {
      path: '/velocity',
      name: 'Velocity',
      component: () => import('@/views/VelocityView.vue'),
    },
    {
      path: '/team',
      name: 'Team',
      component: () => import('@/views/TeamView.vue'),
    },
    {
      path: '/overview',
      name: 'Overview',
      component: () => import('@/views/OverviewView.vue'),
    },
    {
      path: '/cycle-time',
      name: 'Cycle Time',
      component: () => import('@/views/CycleTimeView.vue'),
    },
    {
      path: '/time-analysis',
      name: 'Time Analysis',
      component: () => import('@/views/TimeAnalysisView.vue'),
    },
    {
      path: '/kpi-review',
      name: 'KPI Review',
      component: () => import('@/views/KpiReviewView.vue'),
    },
    {
      path: '/stability',
      name: 'Stability',
      component: () => import('@/views/StabilityView.vue'),
    },
    {
      path: '/scorecard',
      name: 'Scorecard',
      component: () => import('@/views/ScorecardView.vue'),
    },
    {
      path: '/defects',
      name: 'Defects',
      component: () => import('@/views/DefectsView.vue'),
    },
    {
      path: '/commitment-assignee',
      name: 'Commit by Assignee',
      component: () => import('@/views/CommitAssigneeView.vue'),
    },
    {
      path: '/commitment',
      name: 'Commitment',
      component: () => import('@/views/CommitmentView.vue'),
    },
    {
      path: '/config',
      name: 'Configuration',
      component: () => import('@/views/ConfigView.vue'),
    },
  ],
})

export default router
