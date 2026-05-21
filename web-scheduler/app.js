const SHIFT_OPTIONS = [
  { code: "", label: "Vuoto", time: "" },
  { code: "M", label: "Mattina", time: "08/14" },
  { code: "P", label: "Pomeriggio", time: "14/20" },
  { code: "N", label: "Notte", time: "20/08" },
  { code: "CO", label: "Congedo", time: "" },
  { code: "RR", label: "Riposo recupero", time: "" },
  { code: "RS", label: "Riposo settimanale", time: "" },
  { code: "RC", label: "Recupero compensativo", time: "" },
  { code: "ML", label: "Malattia", time: "" },
  { code: "CS", label: "Congedo straordinario", time: "" },
  { code: "PB", label: "Permesso breve", time: "" },
  { code: "CP", label: "Cambio posto", time: "" },
  { code: "MP", label: "Missione", time: "" },
  { code: "INF", label: "Infortunio", time: "" },
  { code: "FS", label: "Fuori servizio", time: "" }
];

const STORAGE_KEY = "turnipp.web.scheduler.v1";

const state = {
  senderName: "",
  serviceLocation: "",
  coordinatorName: "",
  coordinatorEmail: "",
  month: formatMonthInput(new Date()),
  monthLabel: "",
  members: [],
  activeMemberId: null
};

const elements = {
  senderName: document.getElementById("senderName"),
  serviceLocation: document.getElementById("serviceLocation"),
  coordinatorName: document.getElementById("coordinatorName"),
  coordinatorEmail: document.getElementById("coordinatorEmail"),
  scheduleMonth: document.getElementById("scheduleMonth"),
  monthLabel: document.getElementById("monthLabel"),
  membersList: document.getElementById("membersList"),
  calendarGrid: document.getElementById("calendarGrid"),
  schedulerSubtitle: document.getElementById("schedulerSubtitle"),
  quickShiftSelect: document.getElementById("quickShiftSelect"),
  statusBox: document.getElementById("statusBox"),
  memberTemplate: document.getElementById("memberItemTemplate"),
  addMemberButton: document.getElementById("addMemberButton"),
  applyAllButton: document.getElementById("applyAllButton"),
  downloadButton: document.getElementById("downloadButton"),
  shareButton: document.getElementById("shareButton"),
  copyJsonButton: document.getElementById("copyJsonButton"),
  resetButton: document.getElementById("resetButton")
};

boot();

function boot() {
  hydrateState();
  wireFields();
  renderQuickShiftOptions();
  if (!state.members.length) {
    addMember({ name: state.senderName || "", rank: "" });
  }
  renderAll();
  setStatus("Compila il programmato e scarica il file .turniPP oppure condividilo dal browser.");
}

function hydrateState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.monthLabel = formatMonthLabel(state.month);
      return;
    }

    const parsed = JSON.parse(raw);
    Object.assign(state, parsed);
    state.month = parsed.month || formatMonthInput(new Date());
    state.monthLabel = parsed.monthLabel || formatMonthLabel(state.month);
    state.members = Array.isArray(parsed.members) ? parsed.members : [];
    state.activeMemberId = parsed.activeMemberId || state.members[0]?.id || null;
  } catch {
    state.monthLabel = formatMonthLabel(state.month);
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function wireFields() {
  elements.senderName.value = state.senderName;
  elements.serviceLocation.value = state.serviceLocation;
  elements.coordinatorName.value = state.coordinatorName;
  elements.coordinatorEmail.value = state.coordinatorEmail;
  elements.scheduleMonth.value = state.month;
  elements.monthLabel.value = state.monthLabel || formatMonthLabel(state.month);

  elements.senderName.addEventListener("input", (event) => {
    state.senderName = event.target.value;
    persistState();
  });

  elements.serviceLocation.addEventListener("input", (event) => {
    state.serviceLocation = event.target.value;
    persistState();
  });

  elements.coordinatorName.addEventListener("input", (event) => {
    state.coordinatorName = event.target.value;
    persistState();
  });

  elements.coordinatorEmail.addEventListener("input", (event) => {
    state.coordinatorEmail = event.target.value;
    persistState();
  });

  elements.scheduleMonth.addEventListener("input", (event) => {
    state.month = event.target.value;
    if (!elements.monthLabel.dataset.touched) {
      state.monthLabel = formatMonthLabel(state.month);
      elements.monthLabel.value = state.monthLabel;
    }
    ensureMemberShiftMaps();
    persistState();
    renderScheduler();
  });

  elements.monthLabel.addEventListener("input", (event) => {
    elements.monthLabel.dataset.touched = event.target.value ? "true" : "";
    state.monthLabel = event.target.value || formatMonthLabel(state.month);
    persistState();
  });

  elements.addMemberButton.addEventListener("click", () => {
    addMember();
    renderAll();
    setStatus("Nuovo collega aggiunto. Selezionalo e assegna i turni.", "success");
  });

  elements.applyAllButton.addEventListener("click", applyQuickShiftToEmptyDays);
  elements.downloadButton.addEventListener("click", downloadScheduleFile);
  elements.shareButton.addEventListener("click", shareScheduleFile);
  elements.copyJsonButton.addEventListener("click", copyScheduleJson);
  elements.resetButton.addEventListener("click", resetScheduler);
}

function renderQuickShiftOptions() {
  elements.quickShiftSelect.innerHTML = SHIFT_OPTIONS.map((option) =>
    `<option value="${option.code}">${option.code || "Vuoto"} ${option.time ? `- ${option.time}` : ""}</option>`
  ).join("");
}

function addMember(seed = {}) {
  const member = {
    id: makeId(),
    name: seed.name || `Collega ${state.members.length + 1}`,
    rank: seed.rank || "",
    shifts: seed.shifts || {}
  };

  state.members.push(member);
  state.activeMemberId = member.id;
  ensureMemberShiftMaps();
  persistState();
}

function removeMember(memberId) {
  state.members = state.members.filter((member) => member.id !== memberId);
  if (state.activeMemberId === memberId) {
    state.activeMemberId = state.members[0]?.id || null;
  }
  if (!state.members.length) {
    addMember();
  }
  persistState();
  renderAll();
}

function renderAll() {
  renderMembers();
  renderScheduler();
}

function renderMembers() {
  elements.membersList.innerHTML = "";

  state.members.forEach((member) => {
    const fragment = elements.memberTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".member-card");
    const mainButton = fragment.querySelector(".member-card-main");
    const nameEl = fragment.querySelector(".member-name");
    const rankEl = fragment.querySelector(".member-rank");
    const countEl = fragment.querySelector(".member-count");
    const rankInput = fragment.querySelector(".member-rank-input");
    const nameInput = fragment.querySelector(".member-name-input");
    const removeButton = fragment.querySelector(".member-remove-button");

    if (member.id === state.activeMemberId) {
      card.classList.add("active");
    }

    nameEl.textContent = member.name || "Nuovo collega";
    rankEl.textContent = member.rank || "Grado opzionale";
    countEl.textContent = `${Object.keys(member.shifts || {}).length} turni`;
    rankInput.value = member.rank || "";
    nameInput.value = member.name || "";

    mainButton.addEventListener("click", () => {
      state.activeMemberId = member.id;
      persistState();
      renderAll();
    });

    rankInput.addEventListener("input", (event) => {
      member.rank = event.target.value;
      persistState();
      renderMembers();
      renderSchedulerSubtitle();
    });

    nameInput.addEventListener("input", (event) => {
      member.name = event.target.value;
      persistState();
      renderMembers();
      renderSchedulerSubtitle();
    });

    removeButton.addEventListener("click", () => removeMember(member.id));

    elements.membersList.appendChild(fragment);
  });
}

function renderScheduler() {
  const activeMember = state.members.find((member) => member.id === state.activeMemberId);
  if (!activeMember) {
    elements.calendarGrid.className = "calendar-grid empty-state";
    elements.calendarGrid.textContent = "Seleziona un collega per vedere il calendario del mese.";
    renderSchedulerSubtitle();
    return;
  }

  ensureMemberShiftMaps();
  const { year, monthIndex, dayCount } = getMonthMeta(state.month);

  elements.calendarGrid.className = "calendar-grid";
  elements.calendarGrid.innerHTML = "";

  for (let day = 1; day <= dayCount; day += 1) {
    const date = new Date(year, monthIndex, day);
    const card = document.createElement("article");
    card.className = "day-card";
    if (date.getDay() === 0 || date.getDay() === 6) {
      card.classList.add("weekend");
    }

    const selectedValue = activeMember.shifts?.[day] || "";
    const optionMarkup = SHIFT_OPTIONS.map((option) =>
      `<option value="${option.code}" ${selectedValue === option.code ? "selected" : ""}>${option.code || "Vuoto"} ${option.time ? `- ${option.time}` : ""}</option>`
    ).join("");

    card.innerHTML = `
      <header>
        <span class="day-number">${day}</span>
        <span class="day-name">${date.toLocaleDateString("it-IT", { weekday: "short" })}</span>
      </header>
      <select aria-label="Turno giorno ${day}">${optionMarkup}</select>
      <div class="day-time">${lookupShiftTime(selectedValue) || "Nessun orario"}</div>
    `;

    card.querySelector("select").addEventListener("change", (event) => {
      updateShift(activeMember.id, day, event.target.value);
    });

    elements.calendarGrid.appendChild(card);
  }

  renderSchedulerSubtitle();
}

function renderSchedulerSubtitle() {
  const activeMember = state.members.find((member) => member.id === state.activeMemberId);
  if (!activeMember) {
    elements.schedulerSubtitle.textContent = "Seleziona o aggiungi un collega per iniziare.";
    return;
  }

  const displayName = [activeMember.rank, activeMember.name].filter(Boolean).join(" ");
  elements.schedulerSubtitle.textContent = `Stai modificando il programmato di ${displayName || "un collega"} per ${state.monthLabel || formatMonthLabel(state.month)}.`;
}

function updateShift(memberId, day, value) {
  const member = state.members.find((entry) => entry.id === memberId);
  if (!member) {
    return;
  }

  if (!member.shifts) {
    member.shifts = {};
  }

  if (!value) {
    delete member.shifts[day];
  } else {
    member.shifts[day] = value;
  }

  persistState();
  renderMembers();
  renderScheduler();
}

function applyQuickShiftToEmptyDays() {
  const activeMember = state.members.find((member) => member.id === state.activeMemberId);
  if (!activeMember) {
    setStatus("Seleziona prima un collega.", "warning");
    return;
  }

  const quickShift = elements.quickShiftSelect.value;
  if (!quickShift) {
    setStatus("Scegli un turno rapido diverso da Vuoto.", "warning");
    return;
  }

  const { dayCount } = getMonthMeta(state.month);
  let updated = 0;
  for (let day = 1; day <= dayCount; day += 1) {
    if (!activeMember.shifts?.[day]) {
      activeMember.shifts[day] = quickShift;
      updated += 1;
    }
  }

  persistState();
  renderMembers();
  renderScheduler();
  setStatus(`Applicato ${quickShift} a ${updated} giorni liberi per ${activeMember.name || "il collega selezionato"}.`, "success");
}

function buildExportPayload() {
  const { year, monthIndex } = getMonthMeta(state.month);
  const month = monthIndex + 1;
  const members = state.members
    .map((member) => ({
      id: member.id,
      name: member.name.trim(),
      rank: member.rank.trim() || null,
      shifts: normalizeShiftMap(member.shifts)
    }))
    .filter((member) => member.name);

  if (!members.length) {
    throw new Error("Aggiungi almeno un collega con nome valido.");
  }

  return {
    version: 1,
    exportDate: new Date().toISOString(),
    year,
    month,
    monthName: state.monthLabel || formatMonthLabel(state.month),
    senderName: state.senderName.trim() || null,
    serviceLocation: state.serviceLocation.trim() || null,
    members
  };
}

function normalizeShiftMap(shifts = {}) {
  return Object.fromEntries(
    Object.entries(shifts)
      .filter(([, value]) => value)
      .map(([day, value]) => [Number(day), value])
  );
}

function createScheduleFile() {
  const payload = buildExportPayload();
  const json = JSON.stringify(payload, null, 2);
  const fileName = buildFileName(payload);
  const blob = new Blob([json], { type: "application/json" });
  const file = typeof File === "function"
    ? new File([blob], fileName, { type: "application/json" })
    : null;
  return { payload, blob, file, fileName, json };
}

function buildFileName(payload) {
  const safeSender = (payload.senderName || "Programmatore").replace(/\s+/g, "_");
  const safeMonth = payload.monthName.replace(/\s+/g, "_");
  return `Turni_${safeSender}_${safeMonth}.turniPP`;
}

function downloadScheduleFile() {
  try {
    const { blob, fileName } = createScheduleFile();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`File ${fileName} scaricato. Invia questo file al coordinatore o importalo in TurniPP.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function shareScheduleFile() {
  try {
    const { file, fileName } = createScheduleFile();
    if (!file) {
      downloadScheduleFile();
      setStatus("Il browser non supporta la condivisione file diretta. Ho scaricato il file per l'invio manuale al coordinatore.", "warning");
      return;
    }

    const shareData = {
      title: `Programmato ${state.monthLabel || formatMonthLabel(state.month)}`,
      text: buildShareMessage(),
      files: [file]
    };

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share(shareData);
      setStatus(`Condivisione avviata per ${fileName}.`, "success");
      return;
    }

    downloadScheduleFile();
    setStatus("Il browser non supporta la condivisione file diretta. Ho scaricato il file: ora invialo via email, WhatsApp o Telegram al coordinatore.", "warning");
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("Condivisione annullata.", "warning");
      return;
    }

    setStatus(error.message || "Condivisione non riuscita.", "error");
  }
}

async function copyScheduleJson() {
  try {
    const { json } = createScheduleFile();
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API non disponibile");
    }
    await navigator.clipboard.writeText(json);
    setStatus("JSON copiato negli appunti. Puoi incollarlo in un sistema esterno o tenerlo come backup.", "success");
  } catch {
    setStatus("Impossibile copiare negli appunti da questo browser.", "error");
  }
}

function buildShareMessage() {
  const recipient = state.coordinatorName.trim() || "coordinatore";
  const office = state.serviceLocation.trim();
  const pieces = [
    `Invio programmato ${state.monthLabel || formatMonthLabel(state.month)} per ${recipient}.`
  ];

  if (office) {
    pieces.push(`Ufficio: ${office}.`);
  }

  if (state.senderName.trim()) {
    pieces.push(`Mittente: ${state.senderName.trim()}.`);
  }

  if (state.coordinatorEmail.trim()) {
    pieces.push(`Email coordinatore: ${state.coordinatorEmail.trim()}.`);
  }

  return pieces.join(" ");
}

function resetScheduler() {
  if (!window.confirm("Vuoi cancellare tutto il programmato web salvato in locale?")) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  state.senderName = "";
  state.serviceLocation = "";
  state.coordinatorName = "";
  state.coordinatorEmail = "";
  state.month = formatMonthInput(new Date());
  state.monthLabel = formatMonthLabel(state.month);
  state.members = [];
  state.activeMemberId = null;
  elements.monthLabel.dataset.touched = "";
  elements.senderName.value = "";
  elements.serviceLocation.value = "";
  elements.coordinatorName.value = "";
  elements.coordinatorEmail.value = "";
  elements.scheduleMonth.value = state.month;
  elements.monthLabel.value = state.monthLabel;
  addMember();
  renderAll();
  setStatus("Programmatore web resettato.", "success");
}

function ensureMemberShiftMaps() {
  const { dayCount } = getMonthMeta(state.month);
  state.members.forEach((member) => {
    if (!member.shifts || typeof member.shifts !== "object") {
      member.shifts = {};
    }
    Object.keys(member.shifts).forEach((dayKey) => {
      const day = Number(dayKey);
      if (Number.isNaN(day) || day < 1 || day > dayCount) {
        delete member.shifts[dayKey];
      }
    });
  });
}

function getMonthMeta(monthValue) {
  const [yearString, monthString] = monthValue.split("-");
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  return { year, monthIndex, dayCount };
}

function formatMonthLabel(monthValue) {
  const { year, monthIndex } = getMonthMeta(monthValue);
  const date = new Date(year, monthIndex, 1);
  const label = date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatMonthInput(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function lookupShiftTime(code) {
  return SHIFT_OPTIONS.find((option) => option.code === code)?.time || "";
}

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `member-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setStatus(message, tone = "") {
  elements.statusBox.textContent = message;
  elements.statusBox.className = "status-box";
  if (tone) {
    elements.statusBox.classList.add(tone);
  }
}
