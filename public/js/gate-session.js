(() => {
  const hasTabSession = sessionStorage.getItem('angel_gate_session') === 'active';
  if (!hasTabSession) window.location.replace('/gate');
})();
