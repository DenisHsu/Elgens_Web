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
  // Bootstrap's d-lg-none class already handles the responsive line breaks.
  // Do not rewrite innerHTML here: doing so destroys the original markup and
  // also invalidates SplitText's generated nodes after a resize.
}

// window.addEventListener("resize", handleResponsiveBr);
handleResponsiveBr();

// ===== product sliders =====
const sliders = gsap.utils.toArray(".js-product-slider");
const tabs = gsap.utils.toArray(".l-section--products .c-btn-feature--sliders");
const container = document.querySelector(".js-product-container");
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
      display: isActive ? "block" : "none",
      opacity: isActive ? 1 : 0,
      visibility: isActive ? "visible" : "hidden",
      pointerEvents: isActive ? "auto" : "none",
      y: 0
    });
  });
  tabs.forEach((tab, index) => {
    tab.classList.toggle("active", index === activeIndex);
  });
}
function initProductSection() {
  const orderedSliders = getOrderedSliders();
  if (!container || !orderedSliders.length) return;

  const currentIndex = Math.max(0, tabs.findIndex(tab => tab.classList.contains("active")));
  container.style.height = "auto";
  setActiveProduct(orderedSliders, currentIndex);

  tabs.forEach((tab, i) => {
    tab.onclick = e => {
      e.preventDefault();
      setActiveProduct(orderedSliders, i);
    };
  });
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

// share
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
