(() => {
  const pages = [...document.querySelectorAll('.page')];
  const navs = [...document.querySelectorAll('.nav')];
  const toast = document.getElementById('toast');
  const modal = document.getElementById('modal');
  const memberList = document.getElementById('memberList');
  const treeChildren = document.getElementById('treeChildren');
  const memberPill = document.getElementById('memberPill');
  const recordStatus = document.getElementById('recordStatus');
  const finish = document.getElementById('finish');
  const authGate = document.getElementById('authGate');
  const authForm = document.getElementById('authForm');
  const authFeedback = document.getElementById('authFeedback');
  const recoveryForm = document.getElementById('recoveryForm');
  const authSubmit = document.getElementById('authSubmit');
  const confirmPasswordLabel = document.getElementById('confirmPasswordLabel');
  const authPassword = document.getElementById('authPassword');
  let timer;
  let surveys = [];
  let editingId = null;
  let selectedMemberId = 'head';
  let currentUser = null;
  let supabase = null;
  let signUpMode = false;
  let passwordRecoveryMode = false;
  let survey = createEmptySurvey();

  function createEmptySurvey() {
    return {
      household: {},
      members: [{ id: 'head', name: '', relationship: 'Self / Head of household', age: '', details: {} }],
      assets: {}
    };
  }

  function showPasswordRecovery(session) {
    passwordRecoveryMode = true;
    currentUser = session?.user || currentUser;
    authGate.hidden = false;
    document.getElementById('app').hidden = true;
    document.getElementById('accountBar').hidden = true;
    document.getElementById('authConfigMessage').hidden = true;
    document.getElementById('authConfigHelp').hidden = true;
    authForm.hidden = true;
    recoveryForm.hidden = false;
    document.getElementById('recoveryPassword').focus();
  }

  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function supabaseError(error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return new Error('The Supabase surveys table is missing. Run supabase/schema.sql in the project SQL Editor.');
    }
    return new Error(error.message || 'The Supabase request failed. Check your connection and project settings.');
  }

  function setAuthFeedback(message, isError = false) {
    authFeedback.textContent = message;
    authFeedback.classList.toggle('error-state', isError);
  }

  function setAuthAvailability(available) {
    authForm.querySelectorAll('input, button').forEach((control) => {
      control.disabled = !available;
    });
  }

  function updateAuthMode() {
    document.getElementById('authTitle').textContent = signUpMode ? 'Create your account' : 'Sign in to continue';
    document.getElementById('authDescription').textContent = signUpMode
      ? 'Create a private account to save and access your household surveys.'
      : 'Your surveys are private to your account and sync through Supabase.';
    document.getElementById('authSubmit').textContent = signUpMode ? 'Create account' : 'Sign in';
    document.getElementById('authModeToggle').textContent = signUpMode ? 'Back to sign in' : 'Create an account';
    document.getElementById('resetPassword').hidden = signUpMode;
    confirmPasswordLabel.hidden = !signUpMode;
    document.getElementById('authPasswordConfirm').required = signUpMode;
    authPassword.autocomplete = signUpMode ? 'new-password' : 'current-password';
    authPassword.minLength = signUpMode ? 8 : 0;
    setAuthFeedback('');
  }

  function applyAuthSession(session, force = false) {
    const nextUser = session?.user || null;
    if (!force && currentUser?.id === nextUser?.id) return;
    currentUser = nextUser;
    authGate.hidden = Boolean(currentUser);
    document.getElementById('app').hidden = !currentUser;
    const accountBar = document.getElementById('accountBar');
    accountBar.hidden = !currentUser;
    document.getElementById('accountEmail').textContent = currentUser?.email || '';
    recoveryForm.hidden = true;
    authForm.hidden = Boolean(currentUser);
    setAuthAvailability(Boolean(supabase));
    if (currentUser) {
      startNewSurvey();
      loadSurveys();
    } else {
      surveys = [];
      startNewSurvey();
      renderSurveyList();
      updateDashboard();
    }
  }

  async function initializeSupabase() {
    const configMessage = document.getElementById('authConfigMessage');
    const configHelp = document.getElementById('authConfigHelp');
    authForm.hidden = false;
    setAuthAvailability(false);
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Supabase configuration request failed (${response.status}).`);
      const config = await response.json();
      if (!config.configured) {
        configMessage.textContent = 'Supabase settings are not configured yet.';
        configHelp.hidden = false;
        return;
      }

      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      supabase = createClient(config.url, config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      recoveryForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const password = document.getElementById('recoveryPassword').value;
        const confirmation = document.getElementById('recoveryPasswordConfirm').value;
        const feedback = document.getElementById('recoveryFeedback');
        if (password !== confirmation) {
          feedback.textContent = 'The passwords do not match.';
          feedback.classList.add('error-state');
          return;
        }
        const submit = recoveryForm.querySelector('[type="submit"]');
        submit.disabled = true;
        feedback.textContent = 'Updating password…';
        feedback.classList.remove('error-state');
        try {
          const { error } = await supabase.auth.updateUser({ password });
          if (error) throw error;
          passwordRecoveryMode = false;
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          applyAuthSession(data.session, true);
          notify('Password updated.');
        } catch (error) {
          console.error('Password update failed:', error);
          feedback.textContent = error.message || 'Could not update the password.';
          feedback.classList.add('error-state');
        } finally {
          submit.disabled = false;
        }
      });
      document.getElementById('cancelRecovery').addEventListener('click', async () => {
        passwordRecoveryMode = false;
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('Leaving password recovery failed:', error);
          notify(error.message || 'Could not return to sign in.');
        }
        recoveryForm.hidden = true;
        authForm.hidden = false;
      });
      configMessage.hidden = true;
      authForm.hidden = false;
      setAuthAvailability(true);
      supabase.auth.onAuthStateChange((event, session) => {
        window.setTimeout(() => {
          if (event === 'PASSWORD_RECOVERY') {
            showPasswordRecovery(session);
            return;
          }
          if (passwordRecoveryMode) return;
          applyAuthSession(session);
        }, 0);
      });
      const { data, error } = await supabase.auth.getSession();
      if (error) throw supabaseError(error);
      applyAuthSession(data.session);
    } catch (error) {
      console.error('Supabase initialization failed:', error);
      configMessage.textContent = error.message || 'Could not connect to Supabase.';
      authForm.hidden = false;
      setAuthAvailability(false);
      configHelp.hidden = false;
    }
  }

  function go(pageId) {
    const target = document.getElementById(pageId);
    if (!target) return;
    if (!currentUser) {
      authGate.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!document.getElementById('authConfigMessage').hidden) {
        notify('Complete Supabase setup to use the survey workspace.');
      }
      return;
    }

    if (pageId === 'member') loadSelectedMember();
    if (pageId === 'review') updateReview();
    pages.forEach((page) => page.classList.toggle('show', page === target));
    navs.forEach((nav) => nav.classList.toggle('active', nav.dataset.page === pageId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setFieldValues(section, values = {}) {
    document.querySelectorAll(`#${section} [data-field]`).forEach((field) => {
      const value = values[field.dataset.field];
      field.value = value == null ? '' : value;
    });
  }

  function readFieldValues(section) {
    return Object.fromEntries(
      [...document.querySelectorAll(`#${section} [data-field]`)]
        .map((field) => [field.dataset.field, field.value])
    );
  }

  function selectedMember() {
    return survey.members.find((member) => member.id === selectedMemberId) || survey.members[0];
  }

  function captureSelectedMember() {
    const member = selectedMember();
    if (!member) return;
    const fields = readFieldValues('member');
    member.name = fields.name || member.name;
    member.relationship = fields.relationship || member.relationship;
    member.age = fields.age || '';
    member.details = Object.fromEntries(
      Object.entries(fields).filter(([key]) => !['name', 'relationship', 'age'].includes(key))
    );
  }

  function captureForms() {
    survey.household = readFieldValues('household');
    survey.assets = readFieldValues('assets');
    const head = survey.members.find((member) => member.id === 'head');
    if (head) {
      head.name = survey.household.headName || '';
      head.relationship = survey.household.headRelationship || 'Self / Head of household';
    }
    captureSelectedMember();
  }

  function initials(name) {
    return (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  function addText(parent, tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function renderFamily() {
    const household = survey.household;
    const head = survey.members.find((member) => member.id === 'head');
    const headNode = document.getElementById('familyHead');
    if (headNode && head) {
      headNode.querySelector('.face').textContent = initials(household.headName);
      headNode.querySelector('b').textContent = household.headName || 'Household head';
      headNode.querySelector('small').textContent = household.headName
        ? `Head · ${head.age ? `${head.age} years` : 'age not entered'}`
        : 'Enter household profile first';
    }

    memberList.replaceChildren();
    treeChildren.replaceChildren();
    survey.members.forEach((member) => {
      if (member.id !== 'head') {
        const person = document.createElement('div');
        person.className = 'person';
        addText(person, 'div', 'face mint', initials(member.name));
        addText(person, 'b', '', member.name || 'Unnamed member');
        addText(person, 'small', '', `${member.relationship}${member.age ? ` · ${member.age} years` : ''}`);
        addText(person, 'span', 'relation', member.relationship);
        treeChildren.appendChild(person);
      }

      const row = document.createElement('button');
      row.type = 'button';
      row.className = `memberrow${member.id === selectedMemberId ? ' selected' : ''}`;
      addText(row, 'span', 'face blue', initials(member.name));
      const description = document.createElement('span');
      addText(description, 'b', '', member.name || 'Household head');
      addText(description, 'small', '', member.relationship);
      row.appendChild(description);
      addText(row, 'span', '', '›');
      row.addEventListener('click', () => selectMember(member.id));
      memberList.appendChild(row);
    });
    const total = survey.members.length;
    memberPill.textContent = `${total} ${total === 1 ? 'member' : 'members'}`;
    document.getElementById('summaryCount').textContent = `${total} ${total === 1 ? 'member' : 'members'}`;
    document.getElementById('summaryMembers').textContent = String(total);
    document.getElementById('reviewMemberCount').textContent = String(total);
  }

  function loadSelectedMember() {
    const member = selectedMember();
    if (!member) return;
    const household = survey.household;
    const isHead = member.id === 'head';
    document.getElementById('selectedMemberLabel').textContent = member.name || 'Household head';
    setFieldValues('member', {
      ...member.details,
      name: isHead ? household.headName : member.name,
      relationship: isHead ? household.headRelationship : member.relationship,
      age: member.age
    });
    const nameField = document.querySelector('#member [data-field="name"]');
    nameField.readOnly = isHead;
    renderFamily();
  }

  function selectMember(id) {
    captureForms();
    selectedMemberId = id;
    loadSelectedMember();
    go('member');
  }

  function updateReview() {
    captureForms();
    const household = survey.household;
    const locality = [household.locality, household.houseNumber].filter(Boolean).join(' · ');
    document.getElementById('reviewHouseholdName').textContent = locality || 'New household';
    document.getElementById('reviewHeadName').textContent = household.headName || 'No household head entered';
    document.getElementById('reviewDistrict').textContent = household.district || '—';
    document.getElementById('reviewTaluk').textContent = household.taluk || '—';
    document.getElementById('reviewAddress').textContent = household.address || '—';
    document.getElementById('landSummary').textContent = survey.assets.ownsLand || '—';
    document.getElementById('reviewResidence').textContent = survey.assets.ownership || '—';
    document.getElementById('reviewElectricity').textContent = survey.assets.electricity || '—';
    renderFamily();
  }

  function validateHousehold() {
    const fields = [...document.querySelectorAll('#household input, #household select, #member input, #member select, #assets input, #assets select')];
    const invalidField = fields.find((field) => !field.checkValidity());
    if (invalidField) {
      go('household');
      invalidField.reportValidity();
      return false;
    }
    return true;
  }

  function startNewSurvey() {
    editingId = null;
    selectedMemberId = 'head';
    survey = createEmptySurvey();
    setFieldValues('household');
    setFieldValues('assets', { ownsLand: 'No' });
    setFieldValues('member');
    recordStatus.textContent = '● New record';
    finish.textContent = 'Save survey';
    loadSelectedMember();
    updateReview();
    closeModal();
  }

  function loadSurvey(surveyToLoad) {
    editingId = surveyToLoad.id;
    selectedMemberId = 'head';
    survey = {
      household: surveyToLoad.household || {},
      members: Array.isArray(surveyToLoad.members) ? surveyToLoad.members : [],
      assets: surveyToLoad.assets || {}
    };
    if (!survey.members.some((member) => member.id === 'head')) {
      survey.members.unshift({
        id: 'head',
        name: survey.household.headName || '',
        relationship: survey.household.headRelationship || 'Self / Head of household',
        age: '',
        details: {}
      });
    }
    setFieldValues('household', survey.household);
    setFieldValues('assets', survey.assets);
    recordStatus.textContent = '● Editing saved record';
    finish.textContent = 'Update survey';
    loadSelectedMember();
    updateReview();
    go('household');
    notify('Survey opened. Make changes and save when ready.');
  }

  async function saveSurvey() {
    if (!validateHousehold()) return;
    if (!currentUser) {
      notify('Sign in before saving surveys.');
      authGate.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    captureForms();
    try {
      const query = supabase.from('surveys');
      const { data: result, error } = editingId
        ? await query.update(survey).eq('id', editingId).eq('user_id', currentUser.id).select().single()
        : await query.insert({ ...survey, user_id: currentUser.id }).select().single();
      if (error) throw supabaseError(error);
      editingId = result.id;
      recordStatus.textContent = '● Saved to your account';
      finish.textContent = 'Update survey';
      await loadSurveys();
      notify('Survey saved to your private account.');
    } catch (error) {
      console.error('Saving survey failed:', error);
      notify(error.message);
    }
  }

  function renderSurveyList() {
    const list = document.getElementById('surveyList');
    list.replaceChildren();
    if (surveys.length === 0) {
      addText(list, 'p', 'empty-state', 'No saved surveys yet. Choose “New survey” to begin.');
      return;
    }

    surveys.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'survey-row';
      const info = document.createElement('div');
      addText(info, 'strong', '', entry.household?.headName || 'Unnamed household');
      const location = [entry.household?.locality, entry.household?.district].filter(Boolean).join(' · ');
      addText(info, 'small', '', `${location || 'Location not entered'} · ${entry.members?.length || 0} members`);
      addText(info, 'small', 'survey-date', `Updated ${new Date(entry.updated_at).toLocaleString()}`);
      row.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'survey-actions';
      const editButton = addText(actions, 'button', 'secondary', 'Open / edit');
      editButton.type = 'button';
      editButton.addEventListener('click', () => loadSurvey(entry));
      const deleteButton = addText(actions, 'button', 'danger-button', 'Delete');
      deleteButton.type = 'button';
      deleteButton.addEventListener('click', () => deleteSurvey(entry));
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function updateDashboard() {
    const count = surveys.length;
    const people = surveys.reduce((total, entry) => total + (entry.members?.length || 0), 0);
    document.getElementById('surveyCount').textContent = String(count);
    document.getElementById('reviewedCount').textContent = String(count);
    document.getElementById('memberCount').textContent = String(people);
    document.getElementById('showcaseSurveys').textContent = String(count);
    document.getElementById('showcaseHouseholds').textContent = String(count);
    document.getElementById('showcaseFamilies').textContent = String(people);
  }

  async function loadSurveys() {
    if (!supabase || !currentUser) return;
    const requestedUserId = currentUser.id;
    try {
      const { data, error } = await supabase
        .from('surveys')
        .select('id, user_id, household, members, assets, created_at, updated_at')
        .eq('user_id', requestedUserId)
        .order('updated_at', { ascending: false });
      if (error) throw supabaseError(error);
      if (currentUser?.id !== requestedUserId) return;
      surveys = data;
      renderSurveyList();
      updateDashboard();
    } catch (error) {
      if (currentUser?.id !== requestedUserId) return;
      console.error('Loading surveys failed:', error);
      document.getElementById('surveyList').replaceChildren();
      addText(document.getElementById('surveyList'), 'p', 'empty-state error-state', error.message);
      notify(error.message);
    }
  }

  async function deleteSurvey(entry) {
    if (!window.confirm(`Delete the survey for ${entry.household?.headName || 'this household'}? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('surveys').delete()
        .eq('id', entry.id)
        .eq('user_id', currentUser.id);
      if (error) throw supabaseError(error);
      if (editingId === entry.id) startNewSurvey();
      await loadSurveys();
      notify('Survey deleted.');
    } catch (error) {
      console.error('Deleting survey failed:', error);
      notify(error.message);
    }
  }

  function closeModal() {
    modal.classList.remove('open');
  }

  document.getElementById('authModeToggle').addEventListener('click', () => {
    signUpMode = !signUpMode;
    authForm.reset();
    updateAuthMode();
  });
  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = authPassword.value;
    if (signUpMode && password !== document.getElementById('authPasswordConfirm').value) {
      setAuthFeedback('The passwords do not match.', true);
      return;
    }

    authSubmit.disabled = true;
    setAuthFeedback(signUpMode ? 'Creating your account…' : 'Signing in…');
    try {
      const result = signUpMode
        ? await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin }
        })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (signUpMode && !result.data.session) {
        setAuthFeedback('Account created. Check your email to confirm the account, then sign in.');
      } else {
        setAuthFeedback('Signed in successfully.');
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      const message = /email rate limit exceeded/i.test(error.message || '')
        ? 'Supabase temporarily limited confirmation emails. Wait before retrying, check Authentication → Users for an existing account, or configure custom SMTP in Authentication → SMTP Settings.'
        : error.message || 'Authentication failed. Check your details and try again.';
      setAuthFeedback(message, true);
    } finally {
      authSubmit.disabled = false;
    }
  });
  document.getElementById('resetPassword').addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim();
    if (!email) {
      setAuthFeedback('Enter your email address first.', true);
      document.getElementById('authEmail').focus();
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      setAuthFeedback('If that account exists, a password-reset email is on its way.');
    } catch (error) {
      console.error('Password reset request failed:', error);
      setAuthFeedback(error.message || 'Could not request a password reset.', true);
    }
  });
  document.getElementById('signOut').addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out failed:', error);
      notify(error.message || 'Could not sign out.');
    }
  });

  navs.forEach((nav) => nav.addEventListener('click', () => {
    if (nav.classList.contains('new-survey')) startNewSurvey();
    go(nav.dataset.page);
  }));
  document.querySelectorAll('[data-go]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.go === 'household') startNewSurvey();
      go(button.dataset.go);
    });
  });

  document.getElementById('addMember').addEventListener('click', () => {
    captureForms();
    modal.classList.add('open');
    document.getElementById('newName').focus();
  });
  document.getElementById('close').addEventListener('click', closeModal);
  document.getElementById('cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.getElementById('save').addEventListener('click', () => {
    const nameField = document.getElementById('newName');
    const invalidField = [...modal.querySelectorAll('input')].find((field) => !field.checkValidity());
    if (invalidField) {
      invalidField.reportValidity();
      return;
    }
    survey.members.push({
      id: crypto.randomUUID(),
      name: nameField.value.trim(),
      relationship: document.getElementById('newRelation').value,
      age: document.getElementById('newAge').value,
      details: {}
    });
    selectedMemberId = survey.members[survey.members.length - 1].id;
    nameField.value = '';
    document.getElementById('newAge').value = '';
    closeModal();
    loadSelectedMember();
    go('member');
    notify('Family member added. Add their details before saving.');
  });
  document.getElementById('refreshSurveys').addEventListener('click', loadSurveys);
  finish.addEventListener('click', saveSurvey);

  document.querySelectorAll('#household [data-field]').forEach((field) => {
    field.addEventListener('input', () => {
      survey.household = readFieldValues('household');
      const head = survey.members.find((member) => member.id === 'head');
      if (head) head.name = survey.household.headName || '';
      renderFamily();
    });
  });
  document.querySelectorAll('#member [data-field]').forEach((field) => {
    field.addEventListener('input', () => {
      captureSelectedMember();
      renderFamily();
    });
  });

  loadSelectedMember();
  renderFamily();
  updateReview();
  updateAuthMode();
  initializeSupabase();
})();
