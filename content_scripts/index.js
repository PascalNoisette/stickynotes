/* global browser, StickyView, Logger */
const portName = `content-script-${window.location.href}`;
const port     = browser.runtime.connect({ name: portName });
const mounsePosition = {
  x: 0,
  y: 0,
};

function watchClickPosition(event) {
  try {
    mounsePosition.x = event.clientX + window.content.pageXOffset;
    mounsePosition.y = event.clientY + window.content.pageYOffset;
  } catch (e) {
    Logger.log(e);
  }
}
document.addEventListener('mousedown', watchClickPosition, true);
port.postMessage({
  portName,
  type: 'load-stickies',
  url:  window.location.href,
});

function isChildWindow() {
  return window !== window.parent;
}

function saveSticky(sticky) {
  port.postMessage({
    type: 'save-sticky',
    portName,
    sticky,
  });
}

function setTags(sticky, tagNames) {
  sticky.tagNames = tagNames;
  port.postMessage({
    type: 'save-sticky',
    portName,
    sticky,
  });
}

function deleteSticky(sticky) {
  if (isChildWindow()) {
    return;
  }
  port.postMessage({
    type: 'delete-sticky',
    portName,
    sticky,
  });
}

function addStickyView(sticky) {
  const stickyView = new StickyView({
    sticky,
    onClickDeleteButton:   () => setTimeout(() => deleteSticky(sticky), 0),
    onClickMinimizeButton: () => stickyView.minimize(),
    onClickEditTagButton:  () => stickyView.toggleTagDialog(),
    onClickMenuButton:     () => stickyView.toggleMenuDialog(),
    onTextareaChange:      () => {
      stickyView.sticky.content = stickyView.textarea.value;
      saveSticky(stickyView.sticky);
    },
    onColorChange: (colorItem) => {
      stickyView.sticky.color = colorItem.id;
      saveSticky(stickyView.sticky, { color: colorItem.id });
    },
    onTagsChange: (tags) => setTags(sticky, tags),
    onMoveEnd: () => {
      stickyView.sticky.left = parseInt(stickyView.dom.style.left, 10);
      stickyView.sticky.top  = parseInt(stickyView.dom.style.top, 10);
      setTimeout(() => saveSticky(stickyView.sticky), 0);
      // Wait for minized button handler
    },
    onResizeEnd: () => {
      if (!stickyView.isMinimized()) {
        stickyView.sticky.width  = parseInt(stickyView.dom.style.width, 10);
        stickyView.sticky.height = parseInt(stickyView.dom.style.height, 10) + 7;
        saveSticky(stickyView.sticky);
      }
    },
  });
  if (!document.getElementById(stickyView.dom.id)) {
    document.body.appendChild(stickyView.dom);
  }
  return stickyView;
}

function loadStickies(stickies) {
  stickies.forEach(addStickyView);
}

function createSticky() {
  if (isChildWindow()) {
    return;
  }
  port.postMessage({
    portName,
    type:   'create-sticky',
    sticky: {
      left:     mounsePosition.x,
      top:      mounsePosition.y,
      width:    150,
      height:   100,
      url:      window.location.href,
      title:    window.document.title,
      content:  '',
      color:    'yellow',
      tags:     [],
      tagNames: [],
      state:    StickyView.State.Normal,
    },
  });
  mounsePosition.x += 10;
  mounsePosition.y += 10;
}

function deleteStickyView(sticky) {
  StickyView.deleteDom(sticky);
}

function load(stickies) {
  stickies.forEach((s) => {
    if (s.state !== StickyView.State.Deleted) {
      addStickyView(s);
    }
  });
}

function importedStickies(createdStickies, updatedStickies) {
  load(createdStickies);
  updatedStickies.forEach((sticky) => {
    if (sticky.state === StickyView.State.Deleted) {
      StickyView.deleteDom(sticky);
    } else {
      StickyView.updateDom(sticky);
    }
  });
}

port.onMessage.addListener((msg) => {
  const { type } = msg;
  switch (type) {
    case 'load-stickies':
      loadStickies(msg.stickies);
      break;
    case 'create-sticky':
      if (msg.targetUrl !== window.location.href) {
        return;
      }
      createSticky();
      break;
    case 'created-sticky':
      addStickyView(msg.payload).focus();
      break;
    case 'saved-sticky': {
      const sticky = msg.payload;
      if (sticky.state === StickyView.State.Deleted) {
        StickyView.deleteDom(sticky);
      } else {
        StickyView.updateDom(sticky, { force: true });
      }
      break;
    }
    case 'delete-sticky':
      deleteSticky(msg.payload);
      break;
    case 'deleted-sticky':
      deleteStickyView(msg.payload);
      break;
    case 'cleared-stickies':
      StickyView.deleteAll();
      break;
    case 'imported-stickies': {
      const { createdStickies, updatedStickies } = msg.payload;
      importedStickies(createdStickies, updatedStickies);
      break;
    }
    case 'toggle-visibility':
      if (msg.targetUrl !== window.location.href) {
        return;
      }
      StickyView.toggleVisibilityAllStickies();
      break;
    case 'jump-sticky':
      break;
    case 'focus-sticky': {
      if (msg.targetUrl !== window.location.href) {
        return;
      }
      const sticky = msg.payload;
      const id = `sticky_id_${sticky.id}`;
      const e = document.getElementById(id);
      if (e) {
        e.scrollIntoView();
        e.focus();
      }
      break;
    }
    case 'import':
      break;
    case 'reload':
      break;
    default:
      break;
  }
});
