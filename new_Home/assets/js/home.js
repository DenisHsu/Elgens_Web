gsap.registerPlugin(ScrollTrigger);

// 2026-07-12 修改：這個旗標要在最上面、其他程式碼執行之前就讀出來，因為下面
// restoreSectionAfterResizeReload() 的 IIFE 會在腳本一開始執行時就同步把
// sessionStorage 裡的這筆資料讀走並刪除；如果晚一點（例如在 window "load"
// 監聽器裡）才用同樣的 key 去讀，會永遠讀到 null，沒辦法判斷這次載入是不是
// 因為「換尺寸強制重新整理」而來的。
const RESIZE_RELOAD_KEY = "elgensResizeReloadSection";
const wasResizeReload = sessionStorage.getItem(RESIZE_RELOAD_KEY) !== null;

// =====  text fade up =====
const splitInstances = [];
document.fonts.ready.then(() => {
  gsap.registerPlugin(SplitText);
  initTextAnimations();
});
function animateSplitLines(el, split) {
  const linesToAnimate = split.lines.filter(line => line.textContent.trim() !== "");
  return gsap.fromTo(linesToAnimate, {
    yPercent: 100,
    opacity: 0
  }, {
    yPercent: 0,
    opacity: 1,
    duration: 0.3,
    ease: "power1.out",
    stagger: 0.1,
    scrollTrigger: {
      trigger: el,
      start: "top 60%"
    }
  });
}
function initTextAnimations() {
  gsap.utils.toArray(".js-text-fadeup").forEach(el => {
    const split = new SplitText(el, {
      type: "lines",
      linesClass: "lineChild"
    });
    const mask = new SplitText(el, {
      type: "lines",
      linesClass: "lineParent"
    });
    const tween = animateSplitLines(el, split);
    splitInstances.push({
      el,
      split,
      mask,
      tween
    });
  });
}

// 2026-07-09 修改：視窗寬度改變時（例如平板切桌機），GSAP SplitText 依「切割當下」
// 的寬度把整段文字拆成固定的 line 區塊，之後即使容器變寬，這些斷行也不會自動
// 重新排版，導致文字卡在窄版的換行方式、右側留一大塊空白，看起來像跑版。
// 這裡重新切割 lines 並依原本是否已播放過進場動畫決定要不要直接顯示（避免重新
// 整理後文字整段消失、要重新捲動才會出現）。原本這段邏輯被註解關閉，現在改成
// 併入最下面「單一 resize 監聽器」統一呼叫（避免重複監聽器互相干擾，詳見該處註解）。
function resplitTextAnimations() {
  splitInstances.forEach(instance => {
    const { el, split, mask, tween } = instance;
    const alreadyRevealed = !tween || !tween.scrollTrigger || tween.scrollTrigger.progress > 0;
    if (tween) {
      if (tween.scrollTrigger) tween.scrollTrigger.kill();
      tween.kill();
    }
    split.revert();
    mask.revert();
    const newSplit = new SplitText(el, { type: "lines", linesClass: "lineChild" });
    const newMask = new SplitText(el, { type: "lines", linesClass: "lineParent" });
    const newTween = animateSplitLines(el, newSplit);
    if (alreadyRevealed) {
      newTween.progress(1);
    }
    instance.split = newSplit;
    instance.mask = newMask;
    instance.tween = newTween;
  });
}

function handleResponsiveBr() {
  const headers = document.querySelectorAll(".js-text-fadeup");
  headers.forEach(el => {
    if (window.innerWidth >= 1400) {
      el.innerHTML = el.innerHTML.replace(/<br\s*class="d-lg-none"\s*\/?>/g, "");
    } else {
      el.innerHTML = el.innerHTML.replace(/<br\s*class="d-lg-none"\s*\/?>/g, "<br>");
    }
  });
}

// window.addEventListener("resize", handleResponsiveBr);
handleResponsiveBr();

// ===== product sliders =====
const sliders = gsap.utils.toArray(".js-product-slider");
const tabs = gsap.utils.toArray(".l-section--products .c-btn-feature--sliders");
const sectionProduct = document.querySelector(".l-section--products");
const container = document.querySelector(".js-product-container");
let productTL;
let scrollTriggerInstance;
function getProductIndex(tab) {
  return Number.parseInt(tab.dataset.index, 10);
}
function getSliderByIndex(index) {
  return sliders.find(slider => slider.id === `product-${index}`);
}
function getOrderedSliders() {
  return tabs.map(tab => getSliderByIndex(getProductIndex(tab))).filter(Boolean);
}
function setActiveProduct(orderedSliders, activeIndex) {
  orderedSliders.forEach((slider, index) => {
    const isActive = index === activeIndex;
    gsap.set(slider, {
      opacity: isActive ? 1 : 0,
      visibility: isActive ? "visible" : "hidden",
      pointerEvents: isActive ? "auto" : "none",
      y: 0,
      zIndex: isActive ? 2 : 1
    });
  });
  tabs.forEach((tab, index) => {
    tab.classList.toggle("active", index === activeIndex);
  });
}
function initProductSection() {
  const isDesktop = window.innerWidth >= 1400;
  const orderedSliders = getOrderedSliders();

  // 清除先前動畫
  gsap.killTweensOf(sliders);
  if (scrollTriggerInstance) {
    scrollTriggerInstance.kill();
    scrollTriggerInstance = null;
  }
  gsap.set(sliders, { clearProps: "all" });
  gsap.set(sectionProduct, { clearProps: "all" });
  container.style.height = "auto";

  if (isDesktop) {
    // 桌面版
    setActiveProduct(orderedSliders, 0);

    // 計算最大高度
    let maxHeight = 0;
    orderedSliders.forEach(slider => {
      gsap.set(slider, { position: "relative", visibility: "visible", opacity: 1 });
      const h = slider.offsetHeight;
      if (h > maxHeight) maxHeight = h;
      gsap.set(slider, { clearProps: "position,visibility,opacity" });
    });
    container.style.height = maxHeight + "px";
    setActiveProduct(orderedSliders, 0);

    const scrollDistance = window.innerHeight * (orderedSliders.length - 1);

    scrollTriggerInstance = ScrollTrigger.create({
      id: "product-st",
      trigger: sectionProduct,
      start: "top-=72 top",
      end: "+=" + scrollDistance,
      scrub: true,
      pin: true,
      onUpdate: self => {
        const index = Math.min(
          Math.round(self.progress * (orderedSliders.length - 1)),
          orderedSliders.length - 1
        );
        setActiveProduct(orderedSliders, index);
      }
    });

    // 點按按鈕切換 timeline
    // 點按按鈕切換 timeline + 更新 active
tabs.forEach((tab, i) => {
  tab.onclick = e => {
    e.preventDefault();
    if (!scrollTriggerInstance) return;
    const targetProgress = i / (orderedSliders.length - 1);
    const scrollTo = scrollTriggerInstance.start + (scrollTriggerInstance.end - scrollTriggerInstance.start) * targetProgress;
    setActiveProduct(orderedSliders, i);
    window.scrollTo({
      top: scrollTo,
      behavior: "smooth"
    });
  };
});

  } else {
  // ===== 手機版 =====
  sliders.forEach(item => 
    gsap.set(item, { opacity: 1, pointerEvents: "auto", clearProps: "y" })
  );
  container.style.height = "auto";

  // 顯示按鈕
  tabs.forEach(tab => tab.style.display = "inline-block");

  // 全部不 active
  tabs.forEach(t => t.classList.remove("active"));

  // 拿掉這些（不需要）
  // window.addEventListener("scroll", updateActiveTab);
  // updateActiveTab();

  // ✅ 只保留點擊功能
  tabs.forEach((tab, i) => {
    tab.onclick = e => {
      e.preventDefault();
      const slider = getSliderByIndex(getProductIndex(tab));
      if (slider) {
        slider.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
    };
  });
  }
}

// ===== number progress =====
gsap.utils.toArray(".js-counter-number").forEach(el => {
  const raw = el.dataset.number;
  const suffix = raw.replace(/[0-9.]/g, "");
  const target = parseFloat(raw);
  let counter = {
    value: 0
  };
  gsap.to(counter, {
    value: target,
    duration: 2,
    ease: "power1.out",
    scrollTrigger: {
      trigger: el,
      start: "top 80%",
      once: true
    },
    onUpdate: () => {
      el.textContent = Math.floor(counter.value) + suffix;
    }
  });
});

// ===== card stacking =====
const sectionCase = document.querySelector(".l-section--cases");
const cards = gsap.utils.toArray(".l-section--cases .card");
let scrollTriggerInstances = [];
function debounce(func) {
  let wait = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 100;
  let timeout;
  return function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
function initCardStack() {
  const isDesktop = window.innerWidth >= 1400;
  scrollTriggerInstances.forEach(st => st.kill());
  scrollTriggerInstances = [];
  gsap.killTweensOf(cards);
  cards.forEach(card => gsap.set(card, {
    clearProps: "all"
  }));
  // if (!isDesktop) {
  //   cards.forEach(card => gsap.set(card, {
  //     clearProps: "all"
  //   }));
  //   return;
  // }
  gsap.set(sectionCase, {
    clearProps: "all",
    height: "auto"
  });
  if (!isDesktop) return;
  const overlap = 0.98;
  let cardHeights = cards.map(card => card.offsetHeight);
  let totalHeight = cardHeights.reduce((sum, h, i) => {
    if (i === 0) return sum + h;
    return sum + h * overlap;
  }, 0);
  sectionCase.style.height = totalHeight * 1.3 + "px";
  // ScrollTrigger.create({
  const mainPin = ScrollTrigger.create({
    trigger: sectionCase,
    start: "top-=48 top",
    end: () => `+=${totalHeight}`,
    pin: true,
    pinSpacing: false
  });
  //add
  scrollTriggerInstances.push(mainPin);
  let accumulated = 0;
  cards.forEach((card, i) => {
    if (i === 0) return;
    accumulated += cardHeights[i - 1] * overlap;

    // scrollTriggerInstances.push(gsap.to(card, {
    const st = gsap.to(card, {
      y: -accumulated,
      scale: 1 + i * 0.01,
      ease: "power2.out",
      scrollTrigger: {
        trigger: card,
        start: () => `bottom-=${cardHeights[i - 1]}*0.05 bottom`,
        end: () => `top+=${cardHeights[i - 1]} top`,
        scrub: true
      }
      // }));
    });
    scrollTriggerInstances.push(st.scrollTrigger);
  });
}

// 2026-07-12 修改：PRODUCTS 與 CASE STUDY 兩個區塊過去分別各自追蹤自己的圖片
// 載入狀態，圖片一載完就各自重建 ScrollTrigger（initProductSection() 或
// initCardStack()）。這些圖片多數是 loading="lazy"、且有不少是外部網址，載入
// 時機完全不受控——如果使用者已經開始捲動、剛好在這個時間點某張圖片才載入完成
// 觸發重建，PRODUCTS 或 CASE STUDY 的 pin 距離會在使用者「捲動途中」被重新計算、
// 版面跟著跳動，兩個區塊的 pin 起訖位置對不齊，就會在兩者中間多出一段空白
// （使用者實測影片重現：FEATURED PRODUCTS 與 CASE STUDY 之間出現空白）。
// 修正方式：不要邊捲邊補、事後修正，而是「先等兩個區塊全部圖片都準備好，
// 再一次性建立 PRODUCTS + CASE STUDY 的 ScrollTrigger」，兩者的 pin 距離從一
// 開始就是用最終正確的版面算出來的，之後不需要在使用者可能已經在捲動的情況下
// 重新調整。若有圖片遲遲載入不完（例如外部圖床逾時），用一個保險逾時，最多等
// 3 秒就強制以目前狀態初始化，避免整頁卡住不動。
function waitForImages(imgs, timeoutMs) {
  const pending = imgs.filter(img => img.getClientRects().length > 0 && !img.complete);
  if (pending.length === 0) return Promise.resolve();
  return new Promise(resolve => {
    let remaining = pending.length;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const onDone = () => {
      remaining--;
      if (remaining <= 0) finish();
    };
    pending.forEach(img => {
      img.addEventListener("load", onDone, { once: true });
      img.addEventListener("error", onDone, { once: true });
    });
    setTimeout(finish, timeoutMs);
  });
}
function initScrollSections() {
  initProductSection();
  initCardStack();
  ScrollTrigger.refresh();
  // initProductSection()／initCardStack() 都是先用 clearProps 把區塊還原成無
  // 位移的預設狀態，再建立新的 pin／scrub 動畫；scrub 動畫本身要等下一次捲動
  // 事件才會把畫面同步到目前捲動位置。這裡強制呼叫一次 update()，讓畫面立刻
  // 依「目前」捲動位置同步，而不是等使用者再滑一下才對。
  ScrollTrigger.update();
}

// NOTE: resize-triggered recalculation is handled by the single consolidated
// resize listener near the bottom of this file, which now always does a full
// page reload on resize — see that listener's comment for why.

// ==== certificied slider =====
window.addEventListener("load", () => {
  document.querySelectorAll(".tab-content .tab-pane").forEach(tab => {
    const listItems = tab.querySelectorAll(".c-feature-item");
    const perPage = 5;
    let currentPage = 1;
    const totalPage = Math.ceil(listItems.length / perPage);
    if (!listItems.length) return;
    let prevBtn, nextBtn, btnContainer, pageInfo;
    if (totalPage > 1) {
      const pagination = document.createElement("div");
      pagination.className = "c-pagination d-flex justify-content-between align-items-center mt-3 mt-auto";
      const btnWrapper = document.createElement("div");
      btnWrapper.className = "d-flex p-12px c-pagination__container";
      prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "js-btn-prev btn";
      prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
      nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "js-btn-next btn";
      nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
      btnWrapper.appendChild(prevBtn);
      btnWrapper.appendChild(nextBtn);
      pageInfo = document.createElement("p");
      pageInfo.className = "p-20px page-info";
      pagination.appendChild(btnWrapper);
      pagination.appendChild(pageInfo);
      btnContainer = btnWrapper;
      tab.querySelector(".flex-grow-1").appendChild(pagination);
      prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          updateList();
        }
      });
      nextBtn.addEventListener("click", () => {
        if (currentPage < totalPage) {
          currentPage++;
          updateList();
        }
      });
    }
    const updateList = function () {
      let isInit = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      const start = (currentPage - 1) * perPage;
      const end = Math.min(currentPage * perPage, listItems.length);
      listItems.forEach(li => {
        li.style.display = "none";
        li.classList.remove("show");
      });
      listItems.forEach((li, index) => {
        if (index >= start && index < end) {
          li.style.display = "flex";
          const delay = (index - start) * 0.1;
          setTimeout(() => li.classList.add("show"), delay * 1000);
        }
      });
      if (totalPage > 1) {
        pageInfo.textContent = `${currentPage} / ${totalPage}`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPage;
        if (!isInit) {
          const pagElements = [btnContainer, pageInfo];
          pagElements.forEach((el, i) => {
            el.classList.remove("show");
            setTimeout(() => el.classList.add("show"), 200 + i * 100);
          });
        } else {
          [btnContainer, pageInfo].forEach(el => el.classList.add("show"));
        }
      }
    };
    updateList(true);
  });
});
window.addEventListener("load", () => {
  const allTrackedImages = sliders
    .flatMap(slider => Array.from(slider.querySelectorAll("img")))
    .concat(cards.flatMap(card => Array.from(card.querySelectorAll("img"))));
  // 只有第一次載入頁面才需要捲回頂端；跨尺寸重新整理是靠 restoreSectionAfterResizeReload()
  // 還原到原本的區塊，不能在這裡搶著捲到 0（wasResizeReload 在檔案最上面就已經讀好了，
  // 見該處註解）。
  waitForImages(allTrackedImages, 3000).then(() => {
    initScrollSections();
    if (!wasResizeReload) {
      window.scrollTo(0, 0);
      // 捲回頂端後版面可能因為 scrollbar 消失/字型渲染而有微幅變動，稍後再校正一次。
      setTimeout(() => {
        ScrollTrigger.refresh();
        ScrollTrigger.update();
      }, 50);
    }
  });
});

// let resizeTimer;
// window.addEventListener("resize", () => {
//   clearTimeout(resizeTimer);
//   resizeTimer = setTimeout(() => {
//     if (window.innerWidth >= 1400) {
//       location.reload();
//     }
//   }, 200);
// });

// ==== select ====
document.querySelectorAll(".js-tom-select").forEach(el => {
  new TomSelect(el, {
    create: false
  });
});

// share and submit
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('copy-link-btn');
  if (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      navigator.clipboard.writeText(window.location.href).then(function () {
        alert('Link copied!');
      });
    });
  }
  document.getElementById('googleForm').onsubmit = function (e) {
    e.preventDefault();
    if (!this.checkValidity()) {
      this.classList.add('was-validated');
      return;
    }
    let formData = new FormData(this);
    fetch(this.action, {
      method: 'POST',
      body: formData,
      mode: 'no-cors'
    }).then(response => {
      alert('We have received your submitted form. Thank you.');
    }).catch(error => console.error('Error!', error.message));
  };
});
// 2026-07-11 修改：不管是不是跨斷點（平板/桌機），視窗尺寸只要變動就直接整頁
// 重新整理，比逐一補同步（sticky nav、SplitText 斷行、ScrollTrigger pin/scrub）
// 更乾脆、更不會漏掉沒想到的狀況。重新整理前記住「目前在哪一個區塊、在該區塊
// 內的相對位置（0~1）」，重新整理完成後換算成新版面下的捲動位置跳回去——記
// 區塊＋相對位置，而不是記絕對像素 Y，是因為不同寬度下每個區塊的高度都不一樣，
// 直接還原舊的像素 Y 在新版面下很可能落在別的區塊。（RESIZE_RELOAD_KEY 已經在
// 檔案最上面宣告過了，這裡不再重複宣告。）
function getAllSections() {
  return Array.from(document.querySelectorAll(".l-section"));
}
function saveCurrentSectionForReload() {
  const sections = getAllSections();
  const navOffset = 100; // 大約是 sticky sub-nav 的高度，抓落在 nav 下緣的區塊
  let current = sections[0];
  for (const sec of sections) {
    if (sec.getBoundingClientRect().top <= navOffset) {
      current = sec;
    } else {
      break;
    }
  }
  if (!current) return;
  const index = sections.indexOf(current);
  const sectionTop = window.scrollY + current.getBoundingClientRect().top;
  const sectionHeight = current.offsetHeight || 1;
  const ratio = Math.max(0, Math.min(1, (window.scrollY - sectionTop) / sectionHeight));
  try {
    sessionStorage.setItem(RESIZE_RELOAD_KEY, JSON.stringify({ index, ratio }));
  } catch (e) {}
}
(function restoreSectionAfterResizeReload() {
  const raw = sessionStorage.getItem(RESIZE_RELOAD_KEY);
  if (raw === null) return;
  sessionStorage.removeItem(RESIZE_RELOAD_KEY);
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return;
  }
  if (!data || typeof data.index !== "number") return;
  window.addEventListener("load", () => {
    const restoreScroll = () => {
      const sections = getAllSections();
      const target = sections[data.index];
      if (!target) return;
      document.documentElement.style.scrollBehavior = "auto";
      const y = target.offsetTop + (data.ratio || 0) * target.offsetHeight;
      window.scrollTo(0, Math.max(0, y));
      ScrollTrigger.refresh();
      ScrollTrigger.update();
    };
    // 立即還原一次，圖片/字型陸續載入完成、區塊高度可能再變動，200ms 後再修正一次。
    restoreScroll();
    setTimeout(restoreScroll, 200);
  });
})();

let lastWidth = window.innerWidth;
let lastHeight = window.innerHeight;
window.addEventListener("resize", debounce(() => {
  const widthDiff = Math.abs(window.innerWidth - lastWidth);
  const heightDiff = Math.abs(window.innerHeight - lastHeight);
  // 2026-07-12 修改：原本高度變化 >= 60px 也會觸發強制重新整理，但手機/平板瀏覽器
  // 在「捲動時網址列自動收合/展開」也會觸發 resize 事件、把 window.innerHeight
  // 改變 50~150px 不等——這跟使用者主動旋轉螢幕或改變視窗大小是完全不同的情況，
  // 卻會被誤判成「換尺寸」，導致頁面在使用者滑動網頁的過程中不斷自動重新整理，
  // 造成平板上「怎麼滑都滑不動、一直被重整」的情況。
  // 改成只用寬度變化來判斷：實際的換尺寸（桌機拖曳視窗、平板橫直轉向）一定會
  // 造成寬度明顯改變；單純網址列收合只會動到高度、不會動到寬度，因此不會再誤觸發。
  if (widthDiff >= 60) {
    saveCurrentSectionForReload();
    location.reload();
  }
}));
//# sourceMappingURL=home.js.map
