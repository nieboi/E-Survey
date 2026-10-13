(() => {
  const pages = [...document.querySelectorAll('.page')];
  const navs = [...document.querySelectorAll('.nav')];
  const toast = document.getElementById('toast');
  let timer;

  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function go(pageId) {
    const target = document.getElementById(pageId);
    if (!target) return;

    pages.forEach((page) => page.classList.toggle('show', page === target));
    navs.forEach((nav) => nav.classList.toggle('active', nav.dataset.page === pageId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navs.forEach((nav) => {
    nav.addEventListener('click', () => go(nav.dataset.page));
  });

  document.querySelectorAll('[data-go]').forEach((button) => {
    button.addEventListener('click', () => go(button.dataset.go));
  });

  const modal = document.getElementById('modal');
  const addMemberBtn = document.getElementById('addMember');
  const closeBtn = document.getElementById('close');
  const cancelBtn = document.getElementById('cancel');
  const saveBtn = document.getElementById('save');
  const newName = document.getElementById('newName');
  const newRelation = document.getElementById('newRelation');
  const newAge = document.getElementById('newAge');
  const memberList = document.getElementById('memberList');
  const memberPill = document.getElementById('memberPill');
  const treeChildren = document.getElementById('treeChildren');

  function closeModal() {
    if (modal) modal.classList.remove('open');
  }

  if (addMemberBtn) addMemberBtn.addEventListener('click', () => modal.classList.add('open'));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  if (saveBtn) saveBtn.addEventListener('click', () => {
    const name = (newName?.value || '').trim();
    if (!name) {
      notify('Enter a fictional member name first.');
      newName?.focus();
      return;
    }

    const relation = newRelation?.value || 'Member';
    const age = newAge?.value || '';
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();

    const button = document.createElement('button');
    button.className = 'memberrow';
    button.innerHTML = `
      <span class="face blue">${initials}</span>
      <span><b>${name} (Sample)</b><small>${relation}${age ? ` · ${age} years` : ''}</small></span>
      <span>›</span>
    `;

    if (memberList) memberList.appendChild(button);

    const person = document.createElement('div');
    person.className = 'person';
    person.innerHTML = `
      <div class="face blue">${initials}</div>
      <b>${name}</b>
      <small>${relation}${age ? ` · ${age} years` : ''}</small>
      <span class="relation">${relation}</span>
    `;
    if (treeChildren) treeChildren.appendChild(person);

    if (memberPill) {
      const count = memberList ? memberList.children.length : 0;
      memberPill.textContent = `${count} members`;
    }

    closeModal();
    newName.value = '';
    newRelation.value = 'Spouse';
    newAge.value = '';
    notify('Member added to the sample family tree.');
  });

  const finish = document.getElementById('finish');
  if (finish) {
    finish.addEventListener('click', () => notify('Demo complete — no data was submitted or transmitted.'));
  }
})();
