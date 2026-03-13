// Hide splash immediately for non-authenticated users (no API wait needed)
if (!localStorage.getItem('sb-access-token')) {
  document.getElementById('loadingSplash').style.display = 'none';
}
