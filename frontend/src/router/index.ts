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
      path: '/time-analysis',
      name: 'Time Analysis',
      component: () => import('@/views/TimeAnalysisView.vue'),
    },
    {
      path: '/quality',
      name: 'Quality',
      component: () => import('@/views/QualityView.vue'),
    },
    {
      path: '/scorecard',
      name: 'Scorecard',
      component: () => import('@/views/ScorecardView.vue'),
    },
    {
      path: '/commitment',
      name: 'Commitment',
      component: () => import('@/views/CommitmentView.vue'),
    },
    {
      path: '/timesheet',
      name: 'Timesheet',
      component: () => import('@/views/TimesheetView.vue'),
    },
    {
      path: '/config',
      name: 'Configuration',
      component: () => import('@/views/ConfigView.vue'),
    },
  ],
})

export default router
