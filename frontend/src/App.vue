<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app">
    <nav class="nav">
      <RouterLink to="/burndown" class="nav-link">Burndown</RouterLink>
      <RouterLink to="/velocity" class="nav-link">Velocity</RouterLink>
      <RouterLink to="/overview" class="nav-link">Overview</RouterLink>
      <RouterLink to="/cycle-time" class="nav-link">Cycle</RouterLink>
      <RouterLink to="/time-analysis" class="nav-link">Time</RouterLink>
      <RouterLink to="/team" class="nav-link">Team</RouterLink>
      <RouterLink to="/stability" class="nav-link">Stability</RouterLink>
      <RouterLink to="/scorecard" class="nav-link">Scorecard</RouterLink>
      <RouterLink to="/kpi-review" class="nav-link">KPI Review</RouterLink>
      <RouterLink to="/defects" class="nav-link">Defects</RouterLink>
      <RouterLink to="/commitment" class="nav-link">Commit</RouterLink>
      <RouterLink to="/commitment-assignee" class="nav-link">Commit/Asgn</RouterLink>
      <RouterLink to="/config" class="nav-link">Config</RouterLink>
    </nav>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f4f5f7;
  color: #172b4d;
}

.app {
  min-height: 100vh;
}

.nav {
  display: flex;
  gap: 0;
  background: #0747a6;
  padding: 0 24px;
}

.nav-link {
  color: #fff;
  text-decoration: none;
  padding: 14px 20px;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 3px solid transparent;
  transition: background 0.2s, border-color 0.2s;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-link.router-link-active {
  border-bottom-color: #fff;
  background: rgba(255, 255, 255, 0.15);
}

.main {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
