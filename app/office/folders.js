// Five end-tab file folders floating in the film. Pick one and it comes
// forward and opens like a book: the inside cover on the left, the papers on
// the right, with divider tabs to move between sheets.
import { INTAKE, FILING, tabColor } from './intake.js';
import { usd } from '../ui/figures.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const shortRole = (r) => r.split(/[;,(]/)[0].trim();
const W_CLOSED = 26.4, W_SPREAD = 50.4, H = 30;
const CARD_FILING = { mfj: 'Married, joint', single: 'Single', hoh: 'Head of household' };

export class Files {
  constructor(root, worlds, { onOpen }) {
    this.root = root;
    this.worlds = worlds;
    this.onOpen = onOpen;
    this.openId = null;
    this.render();
    addEventListener('resize', () => this.layout());
    root.addEventListener('pointermove', (e) => this.tilt(e));
    root.addEventListener('pointerleave', () => this.tilt(null));
  }

  render() {
    this.root.innerHTML = this.worlds.map((w, i) => this.folder(w, i)).join('');
    this.els = [...this.root.querySelectorAll('.folder')];
    this.els.forEach((el) => {
      el.addEventListener('click', (e) => {
        if (this.openId) return;
        e.stopPropagation();
        this.open(el.dataset.id);
      });
      el.querySelectorAll('.stab').forEach((t) => t.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.openId === el.dataset.id) this.pick(el, +t.dataset.k);
      }));
    });
    this.layout();
  }

  folder(w, i) {
    const t = INTAKE[w.id];
    const letters = t.surname.slice(0, 2).toUpperCase();
    const day = String(2 + i).padStart(2, '0');
    const received = `${MON[2]} ${day} 2026`;
    const folderDocs = w.documents.filter((d) => d.facility === 'folder');
    const elsewhere = w.documents.length - folderDocs.length;
    const ref = w.facts.reference_2025_return;
    const due = ref.refund >= 0;
    const pages = [
      ['Household', `
        <div class="lh"><span>Intake</span><span>No. ${String(i + 1).padStart(2, '0')}</span></div>
        <h3>${esc(w.name)}</h3>
        <p>${esc(t.prose)}</p>
        <table>${w.members.map((m) => `<tr><td>${esc(m.name)}</td><td class="a">${m.age}</td><td class="r">${esc(shortRole(m.role))}</td></tr>`).join('')}</table>`],
      ['Folder', `
        <div class="lh"><span>In the folder</span><span>${folderDocs.length} items</span></div>
        <ol>${folderDocs.map((d) => `<li>${esc(d.title)}</li>`).join('')}</ol>
        <div class="fn">${elsewhere} more sources are somewhere else in the office.</div>`],
      ['Numbers', `
        <div class="lh"><span>Reference return</span><span>2025</span></div>
        <dl>
          <div><dt>Adjusted gross income</dt><i></i><dd>${usd(ref.agi)}</dd></div>
          <div><dt>${ref.itemizing ? 'Itemized' : 'Standard'} deduction</dt><i></i><dd>${usd(ref.deduction)}</dd></div>
          <div><dt>Taxable income</dt><i></i><dd>${usd(ref.taxable_income)}</dd></div>
          <div><dt>Total tax</dt><i></i><dd>${usd(ref.total_tax)}</dd></div>
          <div class="sum"><dt>${due ? 'Refund' : 'Balance due'}</dt><i></i><dd>${usd(Math.abs(ref.refund))}</dd></div>
        </dl>
        <div class="fn">Computed by the engine. Every opportunity in this household is priced against this return.</div>`],
    ];
    const tabX = [1.0, 9.1, 14.9];
    return `
    <div class="folder" data-id="${w.id}" style="--bob:${6.5 + (i % 3) * 0.9}s;--delay:${-i * 1.3}s">
      <div class="float"><div class="body" style="--rz:${[-2.5, 1.5, -0.8, 2.2, -1.6][i % 5]}deg;--in:${0.15 + i * 0.09}s">
        <div class="back manila"></div>
        <div class="tab manila"><span class="yr">25</span>${[...letters].map((c) => `<span class="ab" style="background:${tabColor(c)}">${c}</span>`).join('')}</div>
        <div class="sheets">${pages.map(([name, html], k) => `
          <div class="sheet${k === 0 ? ' up' : ''}" data-pos="${k}" style="z-index:${3 - k}">
            <button class="stab" data-k="${k}" style="left:${tabX[k]}em" tabindex="-1"><span>${name}</span></button>
            <div class="page">${html}</div>
          </div>`).join('')}
        </div>
        <div class="front">
          <div class="face out manila">
            <div class="label"><div class="sn">${esc(t.surname)}</div><div class="gv">${esc(t.given)}</div><div class="pl">${esc(t.place)}</div><div class="ty">TY 2025 · ${w.filing_status.toUpperCase()}</div></div>
            <div class="stamp">Received<b>${received}</b></div>
          </div>
          <div class="face in manila">
            <div class="clip"></div>
            <div class="card">
              <h4>${esc(t.surname)}</h4>
              <div><span class="k">Filed as</span>${esc(CARD_FILING[w.filing_status])}</div>
              <div><span class="k">Lives in</span>${esc(t.place)}</div>
              <div><span class="k">People</span>${w.members.length}</div>
              <div><span class="k">In folder</span>${folderDocs.length} documents</div>
              <div><span class="k">Received</span>${received}</div>
              <div><span class="k">Due</span>APR 15 2026</div>
            </div>
          </div>
        </div>
      </div></div>
    </div>`;
  }

  // Where every folder sits: a fanned row, or one folder open in the middle.
  layout() {
    const vw = innerWidth, vh = innerHeight, n = this.els.length;
    const narrow = vw < 760;
    this.root.classList.toggle('narrow', narrow);
    if (this.openId) {
      const fs = narrow ? Math.min((vw * 0.92) / W_CLOSED, (vh * 0.6) / (H + 2)) : Math.min((vw * 0.86) / W_SPREAD, (vh * 0.64) / (H + 2));
      const el = this.els.find((e) => e.dataset.id === this.openId);
      const left = narrow ? (vw - W_CLOSED * fs) / 2 + 0.6 * fs : vw / 2 - 1.2 * fs;
      Object.assign(el.style, { fontSize: `${fs}px`, left: `${left}px`, top: `${(vh - H * fs) / 2 - vh * 0.045}px` });
      return;
    }
    if (narrow) {
      // A cascading stack, each folder's label showing above the next.
      const fs = Math.min((vw * 0.8) / W_CLOSED, (vh * 0.4) / H);
      const top0 = vh * 0.18, room = vh * 0.92 - top0 - H * fs;
      const step = Math.max(40, room / (n - 1));
      this.els.forEach((el, i) => Object.assign(el.style, { fontSize: `${fs}px`, left: `${(vw - W_CLOSED * fs) / 2 + (i % 2 ? 6 : -6)}px`, top: `${top0 + i * step}px`, zIndex: i }));
      return;
    }
    const gap = Math.min(44, vw * 0.025);
    const fs = Math.min((vw * 0.86 - gap * (n - 1)) / n / W_CLOSED, (vh * 0.4) / H, 9.2);
    const total = n * W_CLOSED * fs + (n - 1) * gap;
    this.els.forEach((el, i) => Object.assign(el.style, { fontSize: `${fs}px`, left: `${(vw - total) / 2 + i * (W_CLOSED * fs + gap)}px`, top: `${vh * 0.52 - (H * fs) / 2}px`, zIndex: '' }));
  }

  // The row leans toward the pointer a little.
  tilt(e) {
    if (this.openId) return;
    const mx = e ? e.clientX / innerWidth - 0.5 : 0, my = e ? e.clientY / innerHeight - 0.5 : 0;
    const n = this.els.length;
    this.els.forEach((el, i) => {
      const b = el.querySelector('.body');
      b.style.setProperty("--ry", `${((n - 1) / 2 - i) * (innerWidth < 760 ? 0 : 6) + mx * 12}deg`);
      b.style.setProperty('--rx', `${-my * 9}deg`);
    });
  }

  show() {
    this.openId = null;
    this.root.classList.remove('picked');
    this.layout();
    this.tilt(null);
    this.els.forEach((el) => {
      el.classList.remove('away', 'open', 'hidden');
      el.classList.add('enter');
      const b = el.querySelector('.body');
      b.addEventListener('animationend', () => el.classList.remove('enter'), { once: true });
    });
  }

  open(id) {
    this.openId = id;
    this.root.classList.add('picked');
    this.els.forEach((el) => el.classList.toggle('away', el.dataset.id !== id));
    const el = this.els.find((e) => e.dataset.id === id);
    const b = el.querySelector('.body');
    b.style.setProperty('--rx', '0deg'); b.style.setProperty('--ry', '0deg'); b.style.setProperty('--rz', '0deg');
    el.style.zIndex = 10;
    el.querySelectorAll('.stab').forEach((t) => t.tabIndex = 0);
    this.layout();
    setTimeout(() => el.classList.add('open'), 620);
    this.onOpen?.(id);
  }

  close(then) {
    const el = this.els.find((e) => e.dataset.id === this.openId);
    if (!el) return then?.();
    el.classList.remove('open');
    el.querySelectorAll('.stab').forEach((t) => t.tabIndex = -1);
    setTimeout(() => {
      this.openId = null;
      this.root.classList.remove('picked');
      this.layout();
      this.tilt(null);
      this.els.forEach((x) => x.classList.remove('away'));
      then?.();
    }, 650);
  }

  // Close the open folder and let everything drift off.
  dismiss() {
    const el = this.els.find((e) => e.dataset.id === this.openId);
    if (el) el.classList.remove('open');
    setTimeout(() => this.els.forEach((x) => x.classList.add('hidden')), el ? 520 : 0);
  }

  pick(el, k) {
    const sheets = [...el.querySelectorAll('.sheet')];
    const s = sheets[k];
    if (s.classList.contains('up')) return;
    s.classList.add('pull');
    setTimeout(() => {
      const order = sheets.slice().sort((a, b) => +a.dataset.pos - +b.dataset.pos).filter((x) => x !== s);
      order.unshift(s);
      order.forEach((x, pos) => { x.dataset.pos = pos; x.style.zIndex = 3 - pos; x.classList.toggle('up', pos === 0); });
    }, 330);
    s.addEventListener('animationend', () => s.classList.remove('pull'), { once: true });
  }
}
