(function () {
  'use strict';

  var STORAGE_KEY = 'todo-retro.tasks.v1';
  var MAX_LENGTH = 200;

  var form = document.getElementById('task-form');
  var input = document.getElementById('task-input');
  var note = document.getElementById('form-note');
  var list = document.getElementById('task-list');
  var emptyState = document.getElementById('empty-state');
  var clearButton = document.getElementById('clear-done');
  var count = document.getElementById('task-count');
  var listWrap = document.querySelector('.list-wrap');

  var windowEls = {
    tasks: document.getElementById('window-tasks'),
    about: document.getElementById('window-about')
  };

  var iconEls = {
    tasks: document.querySelector('[data-window-target="tasks"]'),
    about: document.querySelector('[data-window-target="about"]')
  };

  var menuButtons = Array.prototype.slice.call(document.querySelectorAll('.menu-button'));
  var clearMenuButton = document.querySelector('[data-menu-action="clear-done"]');
  var closeMenuButton = document.querySelector('[data-menu-action="close-window"]');

  var tasks = loadTasks();
  var activeWindow = null;
  var zCounter = 10;
  var openMenuGroup = null;

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function loadTasks() {
    var raw;

    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return [];
    }

    if (!raw) {
      return [];
    }

    var data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    var seenIds = new Set();
    var loaded = [];

    data.forEach(function (item) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return;
      }
      if (typeof item.text !== 'string') {
        return;
      }

      var text = item.text.trim().slice(0, MAX_LENGTH);
      if (!text) {
        return;
      }

      var id = typeof item.id === 'string' && item.id ? item.id : '';
      if (!id || seenIds.has(id)) {
        id = createId();
      }
      seenIds.add(id);

      loaded.push({
        id: id,
        text: text,
        done: item.done === true
      });
    });

    return loaded;
  }

  function saveTasks() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
    }
  }

  function showNote(message) {
    note.textContent = message;
    note.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  }

  function hideNote() {
    note.textContent = '';
    note.hidden = true;
    input.removeAttribute('aria-invalid');
  }

  function updateSummary() {
    var done = 0;

    tasks.forEach(function (task) {
      if (task.done) {
        done += 1;
      }
    });

    var open = tasks.length - done;
    count.textContent = open + ' open · ' + done + ' done';
    clearButton.disabled = done === 0;

    if (clearMenuButton) {
      clearMenuButton.disabled = done === 0;
    }
  }

  function renderTasks() {
    var fragment = document.createDocumentFragment();

    tasks.forEach(function (task) {
      var item = document.createElement('li');
      item.className = 'task' + (task.done ? ' task--done' : '');
      item.dataset.taskId = task.id;

      var toggle = document.createElement('label');
      toggle.className = 'task-toggle';

      var checkbox = document.createElement('input');
      checkbox.className = 'task-check';
      checkbox.type = 'checkbox';
      checkbox.checked = task.done;

      var text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;

      toggle.appendChild(checkbox);
      toggle.appendChild(text);

      var remove = document.createElement('button');
      remove.className = 'task-delete';
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = 'Delete';
      remove.setAttribute('aria-label', 'Delete task: ' + task.text);

      item.appendChild(toggle);
      item.appendChild(remove);
      fragment.appendChild(item);
    });

    list.replaceChildren(fragment);
    list.hidden = tasks.length === 0;
    emptyState.hidden = tasks.length > 0;

    updateSummary();
  }

  function addTask(value) {
    var text = value.trim().slice(0, MAX_LENGTH);

    if (!text) {
      showNote('Please enter a task.');
      input.focus();
      return;
    }

    hideNote();
    tasks.push({ id: createId(), text: text, done: false });
    saveTasks();
    renderTasks();

    input.value = '';
    input.focus();
    listWrap.scrollTop = listWrap.scrollHeight;
  }

  function deleteTask(id) {
    var index = tasks.findIndex(function (task) {
      return task.id === id;
    });

    if (index === -1) {
      return;
    }

    tasks.splice(index, 1);
    saveTasks();
    renderTasks();

    var buttons = Array.prototype.slice.call(list.querySelectorAll('.task-delete'));
    if (buttons.length) {
      buttons[Math.min(index, buttons.length - 1)].focus();
    } else {
      input.focus();
    }
  }

  function clearDone(fromMenu) {
    var before = tasks.length;
    var hadFocus = document.activeElement === clearButton;

    tasks = tasks.filter(function (task) {
      return !task.done;
    });

    if (tasks.length === before) {
      if (fromMenu) {
        input.focus();
      }
      return;
    }

    saveTasks();
    renderTasks();

    if (fromMenu || hadFocus) {
      input.focus();
    }
  }

  function bringToFront(key) {
    var win = windowEls[key];
    if (!win) {
      return;
    }
    activeWindow = key;
    zCounter += 1;
    win.style.zIndex = String(zCounter);
  }

  function setIconState(key, expanded) {
    var icon = iconEls[key];
    if (icon) {
      icon.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
  }

  function openWindow(key, focusSelector) {
    var win = windowEls[key];
    if (!win) {
      return;
    }

    win.hidden = false;
    bringToFront(key);
    setIconState(key, true);
    updateCloseMenuState();

    if (focusSelector) {
      var target = win.querySelector(focusSelector);
      if (target) {
        target.focus();
      }
    }
  }

  function updateCloseMenuState() {
    if (!closeMenuButton) {
      return;
    }
    closeMenuButton.disabled = !Object.keys(windowEls).some(function (key) {
      return !windowEls[key].hidden;
    });
  }

  function closeWindow(key) {
    var win = windowEls[key];
    if (!win || win.hidden) {
      return;
    }

    win.hidden = true;
    setIconState(key, false);

    if (activeWindow === key) {
      activeWindow = Object.keys(windowEls).find(function (otherKey) {
        return otherKey !== key && !windowEls[otherKey].hidden;
      }) || null;
    }

    updateCloseMenuState();

    if (iconEls[key]) {
      iconEls[key].focus();
    }
  }

  function closeActiveWindow() {
    var visible = Object.keys(windowEls).filter(function (key) {
      return !windowEls[key].hidden;
    });

    if (!visible.length) {
      return;
    }

    var key = activeWindow && visible.indexOf(activeWindow) !== -1
      ? activeWindow
      : visible[visible.length - 1];

    closeWindow(key);
  }

  function closeMenu(returnFocus) {
    if (!openMenuGroup) {
      return;
    }

    var group = openMenuGroup;
    openMenuGroup = null;
    group.list.hidden = true;
    group.button.setAttribute('aria-expanded', 'false');

    if (returnFocus) {
      group.button.focus();
    }
  }

  function openMenu(button, listEl) {
    closeMenu(false);
    listEl.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    openMenuGroup = { button: button, list: listEl };

    var first = listEl.querySelector('button:not(:disabled)');
    if (first) {
      first.focus();
    }
  }

  menuButtons.forEach(function (button) {
    var listEl = document.getElementById(button.getAttribute('aria-controls'));

    button.addEventListener('click', function () {
      if (!listEl.hidden) {
        closeMenu(true);
        return;
      }
      openMenu(button, listEl);
    });

    listEl.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }

      event.preventDefault();
      var items = Array.prototype.slice.call(listEl.querySelectorAll('button:not(:disabled)'));
      if (!items.length) {
        return;
      }

      var current = items.indexOf(document.activeElement);
      var next;

      if (event.key === 'ArrowDown') {
        next = current < 0 ? 0 : (current + 1) % items.length;
      } else {
        next = current <= 0 ? items.length - 1 : current - 1;
      }

      items[next].focus();
    });
  });

  document.addEventListener('click', function (event) {
    if (openMenuGroup && !openMenuGroup.button.parentElement.contains(event.target)) {
      closeMenu(false);
    }
  });

  document.addEventListener('focusin', function (event) {
    if (openMenuGroup && !openMenuGroup.button.parentElement.contains(event.target)) {
      closeMenu(false);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && openMenuGroup) {
      event.preventDefault();
      closeMenu(true);
    }
  });

  document.querySelector('.menu').addEventListener('click', function (event) {
    var actionButton = event.target.closest('[data-menu-action]');
    if (!actionButton) {
      return;
    }

    var action = actionButton.getAttribute('data-menu-action');
    closeMenu(false);

    if (action === 'new-task') {
      openWindow('tasks', '#task-input');
    } else if (action === 'close-window') {
      closeActiveWindow();
    } else if (action === 'show-tasks') {
      openWindow('tasks', '#task-input');
    } else if (action === 'show-about') {
      openWindow('about', '.close-box');
    } else if (action === 'clear-done') {
      clearDone(true);
    }
  });

  Object.keys(iconEls).forEach(function (key) {
    iconEls[key].addEventListener('click', function () {
      if (key === 'tasks') {
        openWindow('tasks', '#task-input');
      } else {
        openWindow('about', '.close-box');
      }
    });
  });

  Object.keys(windowEls).forEach(function (key) {
    var win = windowEls[key];

    win.addEventListener('pointerdown', function () {
      bringToFront(key);
    });

    win.addEventListener('focusin', function () {
      bringToFront(key);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (button) {
    button.addEventListener('click', function () {
      closeWindow(button.getAttribute('data-close'));
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    addTask(input.value);
  });

  input.addEventListener('input', function () {
    if (!note.hidden) {
      hideNote();
    }
  });

  list.addEventListener('change', function (event) {
    var checkbox = event.target.closest('.task-check');
    if (!checkbox) {
      return;
    }

    var item = checkbox.closest('.task');
    var task = tasks.find(function (entry) {
      return entry.id === item.dataset.taskId;
    });

    if (!task) {
      return;
    }

    task.done = checkbox.checked;
    item.classList.toggle('task--done', task.done);
    saveTasks();
    updateSummary();
  });

  list.addEventListener('click', function (event) {
    var removeButton = event.target.closest('.task-delete');
    if (!removeButton) {
      return;
    }

    var item = removeButton.closest('.task');
    deleteTask(item.dataset.taskId);
  });

  clearButton.addEventListener('click', function () {
    clearDone(false);
  });

  renderTasks();
  updateCloseMenuState();
  openWindow('tasks', null);
})();
