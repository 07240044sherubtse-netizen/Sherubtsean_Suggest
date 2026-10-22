document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  document.querySelectorAll('[data-tab-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-tab-target');
      document.querySelectorAll('[data-tab-target]').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('[data-tab-panel]').forEach((panel) => panel.classList.remove('is-visible'));
      button.classList.add('active');
      const panel = document.querySelector(`[data-tab-panel="${target}"]`);
      if (panel) panel.classList.add('is-visible');
    });
  });

  document.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      const message = form.getAttribute('data-confirm');
      if (!window.confirm(message)) {
        event.preventDefault();
      }
    });
  });

  const upvoteForm = document.querySelector('[data-upvote-form]');
  if (upvoteForm) {
    upvoteForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = upvoteForm.querySelector('[data-upvote-button]');
      if (button) button.disabled = true;

      try {
        const response = await fetch(upvoteForm.action, {
          method: 'POST',
          headers: {
            'x-requested-with': 'fetch',
            'x-csrf-token': upvoteForm.querySelector('[name="_csrf"]').value
          }
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not update upvote.');
        }

        const label = upvoteForm.querySelector('[data-upvote-label]');
        const count = upvoteForm.querySelector('[data-upvote-count]');
        if (label) label.textContent = data.liked ? 'Upvoted' : 'Upvote';
        if (count) count.textContent = data.likeCount;
        if (button) {
          button.classList.toggle('btn-accent', data.liked);
          button.classList.toggle('btn-secondary', !data.liked);
        }
      } catch (err) {
        window.alert(err.message);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', () => {
      const submit = form.querySelector('button[type="submit"]');
      if (submit && !form.hasAttribute('data-upvote-form')) {
        submit.dataset.originalText = submit.dataset.originalText || submit.textContent;
        submit.textContent = 'Working…';
      }
    });
  });
});
