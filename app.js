(function () {
  const knowledge = window.KNOWLEDGE || [];
  const appEl = document.getElementById("app");
  const navEl = document.getElementById("nav");
  const articleEl = document.getElementById("article");
  const crumbEl = document.getElementById("crumb");
  const sidebarEl = document.getElementById("sidebar");
  const menuBtn = document.getElementById("menuBtn");
  const expandBtn = document.getElementById("expandBtn");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const backdropEl = document.getElementById("backdrop");

  const SIDEBAR_KEY = "notes-sidebar-collapsed";
  const GROUPS_KEY = "notes-group-collapsed";

  const byId = Object.fromEntries(knowledge.map((item) => [item.id, item]));
  let groupCollapsed = loadGroupState();

  function loadGroupState() {
    try {
      return JSON.parse(localStorage.getItem(GROUPS_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveGroupState() {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groupCollapsed));
  }

  function groupByCategory(items) {
    const map = new Map();
    items.forEach((item) => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category).push(item);
    });
    return map;
  }

  function isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function setSidebarCollapsed(collapsed) {
    appEl.classList.toggle("sidebar-collapsed", collapsed);
    expandBtn.hidden = !collapsed || isMobile();
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  }

  function closeMobileSidebar() {
    sidebarEl.classList.remove("open");
    backdropEl.hidden = true;
  }

  function openMobileSidebar() {
    sidebarEl.classList.add("open");
    backdropEl.hidden = false;
  }

  function renderNav(activeId) {
    const groups = groupByCategory(knowledge);
    const activeItem = activeId ? byId[activeId] : null;
    navEl.innerHTML = "";

    groups.forEach((items, category) => {
      const containsActive = activeItem && activeItem.category === category;
      const collapsed =
        groupCollapsed[category] === true && !containsActive;

      const group = document.createElement("section");
      group.className = "nav-group" + (collapsed ? " is-collapsed" : "");

      const titleBtn = document.createElement("button");
      titleBtn.type = "button";
      titleBtn.className = "nav-group-title";
      titleBtn.setAttribute("aria-expanded", String(!collapsed));
      titleBtn.innerHTML =
        '<span class="nav-group-label"></span><span class="nav-group-meta"></span><span class="nav-group-chevron" aria-hidden="true"></span>';
      titleBtn.querySelector(".nav-group-label").textContent = category;
      titleBtn.querySelector(".nav-group-meta").textContent = String(items.length);
      titleBtn.addEventListener("click", () => {
        const next = !group.classList.contains("is-collapsed");
        group.classList.toggle("is-collapsed", next);
        titleBtn.setAttribute("aria-expanded", String(!next));
        groupCollapsed[category] = next;
        saveGroupState();
      });

      const list = document.createElement("ul");
      list.className = "nav-list";

      items.forEach((item) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "nav-item" + (item.id === activeId ? " active" : "");
        btn.dataset.id = item.id;
        btn.title = item.summary || item.title;
        btn.innerHTML = '<span class="nav-item-title"></span>';
        btn.querySelector(".nav-item-title").textContent = item.title;
        btn.addEventListener("click", () => selectItem(item.id));
        li.appendChild(btn);
        list.appendChild(li);
      });

      group.appendChild(titleBtn);
      group.appendChild(list);
      navEl.appendChild(group);
    });
  }

  function renderRelated(item) {
    if (!item.related || !item.related.length) return "";

    const links = item.related
      .map((id) => byId[id])
      .filter(Boolean)
      .map(
        (rel) =>
          `<button class="related-link" type="button" data-id="${rel.id}">→ ${rel.title}</button>`
      )
      .join("");

    if (!links) return "";
    return `<div class="related"><p class="related-title">相关知识点</p>${links}</div>`;
  }

  function selectItem(id) {
    const item = byId[id];
    if (!item) return;

    if (groupCollapsed[item.category]) {
      groupCollapsed[item.category] = false;
      saveGroupState();
    }

    history.replaceState(null, "", `#${id}`);
    renderNav(id);
    crumbEl.textContent = `${item.category} / ${item.title}`;
    articleEl.innerHTML = item.content + renderRelated(item);
    articleEl.style.animation = "none";
    void articleEl.offsetWidth;
    articleEl.style.animation = "";

    articleEl.querySelectorAll(".related-link").forEach((btn) => {
      btn.addEventListener("click", () => selectItem(btn.dataset.id));
    });

    closeMobileSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  sidebarToggle.addEventListener("click", () => {
    if (isMobile()) {
      closeMobileSidebar();
      return;
    }
    setSidebarCollapsed(true);
  });

  expandBtn.addEventListener("click", () => {
    if (isMobile()) {
      openMobileSidebar();
      return;
    }
    setSidebarCollapsed(false);
  });

  menuBtn.addEventListener("click", openMobileSidebar);
  backdropEl.addEventListener("click", closeMobileSidebar);

  window.addEventListener("resize", () => {
    const collapsed = localStorage.getItem(SIDEBAR_KEY) === "1";
    expandBtn.hidden = !collapsed || isMobile();
    if (isMobile()) {
      appEl.classList.remove("sidebar-collapsed");
    } else {
      appEl.classList.toggle("sidebar-collapsed", collapsed);
      closeMobileSidebar();
    }
  });

  const initialCollapsed = localStorage.getItem(SIDEBAR_KEY) === "1";
  if (!isMobile()) setSidebarCollapsed(initialCollapsed);
  else expandBtn.hidden = true;

  const initialId =
    (location.hash && location.hash.slice(1)) ||
    (knowledge[0] && knowledge[0].id);

  if (initialId && byId[initialId]) {
    selectItem(initialId);
  } else {
    renderNav(null);
  }

  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (id && byId[id]) selectItem(id);
  });
})();
