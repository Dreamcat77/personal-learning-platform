(function () {
  const knowledge = window.KNOWLEDGE || [];
  const categoryOrder = window.KNOWLEDGE_CATEGORIES || [];
  const appEl = document.getElementById("app");
  const navEl = document.getElementById("nav");
  const articleEl = document.getElementById("article");
  const crumbEl = document.getElementById("crumb");
  const sidebarEl = document.getElementById("sidebar");
  const menuBtn = document.getElementById("menuBtn");
  const expandBtn = document.getElementById("expandBtn");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const backdropEl = document.getElementById("backdrop");
  const tocEl = document.getElementById("toc");
  const tocNavEl = document.getElementById("tocNav");

  const SIDEBAR_KEY = "notes-sidebar-collapsed";
  const GROUPS_KEY = "notes-group-collapsed";

  const byId = Object.fromEntries(knowledge.map((item) => [item.id, item]));
  let groupCollapsed = loadGroupState();
  let tocObserver = null;
  let currentArticleId = null;

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

    map.forEach((groupItems) => {
      groupItems.sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER) ||
          a.title.localeCompare(b.title, "zh-CN")
      );
    });

    const rank = new Map(categoryOrder.map((category, index) => [category, index]));
    return new Map(
      [...map.entries()].sort(
        ([categoryA], [categoryB]) =>
          (rank.get(categoryA) ?? Number.MAX_SAFE_INTEGER) -
            (rank.get(categoryB) ?? Number.MAX_SAFE_INTEGER) ||
          categoryA.localeCompare(categoryB, "zh-CN")
      )
    );
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

  function slugify(text) {
    return (
      "sec-" +
      text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)
    );
  }

  function collectHeadings() {
    return Array.from(articleEl.querySelectorAll("h2")).filter(
      (h) => h.textContent && h.textContent.trim()
    );
  }

  function setActiveToc(id) {
    tocNavEl.querySelectorAll(".toc-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.target === id);
    });
  }

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (!target) return;
    setActiveToc(id);
    if (currentArticleId) {
      history.replaceState(null, "", `#${currentArticleId}/${id}`);
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderToc() {
    if (tocObserver) {
      tocObserver.disconnect();
      tocObserver = null;
    }

    const headings = collectHeadings();
    tocNavEl.innerHTML = "";

    if (headings.length < 2) {
      tocEl.hidden = true;
      appEl.classList.remove("has-toc");
      return;
    }

    tocEl.hidden = false;
    appEl.classList.add("has-toc");

    headings.forEach((heading, index) => {
      if (!heading.id) {
        heading.id = slugify(heading.textContent.trim()) || `sec-${index}`;
      }

      const label =
        heading.getAttribute("data-toc") || heading.textContent.trim();

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toc-item";
      btn.dataset.target = heading.id;
      btn.textContent = label;
      btn.addEventListener("click", () => scrollToSection(heading.id));
      tocNavEl.appendChild(btn);
    });

    tocObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0] && visible[0].target.id) {
          setActiveToc(visible[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: [0, 0.25, 0.5, 1],
      }
    );

    headings.forEach((heading) => tocObserver.observe(heading));
    setActiveToc(headings[0].id);
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

  function bindArticleLinks() {
    articleEl.querySelectorAll(".related-link, .jump-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.id || "";
        const [articleId, sectionId] = target.split("/");
        if (articleId && byId[articleId]) selectItem(articleId, sectionId);
      });
    });
  }

  function selectItem(id, sectionId) {
    const item = byId[id];
    if (!item) return;

    if (groupCollapsed[item.category]) {
      groupCollapsed[item.category] = false;
      saveGroupState();
    }

    currentArticleId = id;
    history.replaceState(
      null,
      "",
      sectionId ? `#${id}/${sectionId}` : `#${id}`
    );
    renderNav(id);
    crumbEl.textContent = `${item.category} / ${item.title}`;
    articleEl.innerHTML = item.content + renderRelated(item);
    articleEl.style.animation = "none";
    void articleEl.offsetWidth;
    articleEl.style.animation = "";

    bindArticleLinks();
    renderToc();
    closeMobileSidebar();

    if (sectionId && document.getElementById(sectionId)) {
      requestAnimationFrame(() => scrollToSection(sectionId));
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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

  const rawHash = location.hash ? location.hash.slice(1) : "";
  const [hashId, hashSection] = rawHash.split("/");
  const firstGroup = groupByCategory(knowledge).values().next().value;
  const initialId = hashId || (firstGroup && firstGroup[0] && firstGroup[0].id);

  if (initialId && byId[initialId]) {
    selectItem(initialId, hashSection);
  } else {
    renderNav(null);
    tocEl.hidden = true;
  }

  window.addEventListener("hashchange", () => {
    const raw = location.hash.slice(1);
    const [id, section] = raw.split("/");
    if (id && byId[id]) selectItem(id, section);
  });
})();
