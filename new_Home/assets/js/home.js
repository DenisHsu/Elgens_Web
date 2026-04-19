gsap.registerPlugin(ScrollTrigger);

// =====  text fade up =====
const splitInstances = [];
document.fonts.ready.then(() => {
  gsap.registerPlugin(SplitText);
  initTextAnimations();
});
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
    splitInstances.push({
      el,
      split,
      mask
    });
    const linesToAnimate = split.lines.filter(line => line.textContent.trim() !== "");
    gsap.fromTo(linesToAnimate, {
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
  });
}

// window.addEventListener("resize", () => {
//   splitInstances.forEach(instance => {
//     const {
//       el,
//       split,
//       mask
//     } = instance;
//     split.revert();
//     mask.revert();
//     instance.split = new SplitText(el, {
//       type: "lines",
//       linesClass: "lineChild"
//     });
//     instance.mask = new SplitText(el, {
//       type: "lines",
//       linesClass: "lineParent"
//     });
//   });
//   ScrollTrigger.refresh();
// });

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
initCardStack();
//  ScrollTrigger.refresh();

// add
// window.addEventListener("resize", debounce(() => {
//   initCardStack();
//   ScrollTrigger.refresh();
// }, 150));

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
  initProductSection();
  setTimeout(() => {
    window.scrollTo(0, 0);
  }, 50);
  initCardStack();
  ScrollTrigger.refresh();
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
let lastWidth = window.innerWidth;
let lastIsDesktop = window.innerWidth >= 1400;
window.addEventListener("resize", debounce(() => {
  const widthDiff = Math.abs(window.innerWidth - lastWidth);
  const isDesktop = window.innerWidth >= 1400;
  const crossedBreakpoint = isDesktop !== lastIsDesktop;
  if (widthDiff >= 100 || crossedBreakpoint) {
    setTimeout(() => {
      handleResponsiveBr();
      initProductSection();
      initCardStack();
      ScrollTrigger.refresh();
    }, 50);
    lastWidth = window.innerWidth;
    lastIsDesktop = isDesktop;
  }
}));
//# sourceMappingURL=home.js.map
