// Animation utilities using anime.js
declare global {
  interface Window {
    anime: any;
  }
}

export const fadeInUp = (element: string | HTMLElement, delay = 0) => {
  if (typeof window !== 'undefined' && window.anime) {
    window.anime({
      targets: element,
      translateY: [30, 0],
      opacity: [0, 1],
      duration: 800,
      delay,
      easing: 'easeOutCubic'
    });
  }
};

export const scaleIn = (element: string | HTMLElement, delay = 0) => {
  if (typeof window !== 'undefined' && window.anime) {
    window.anime({
      targets: element,
      scale: [0.8, 1],
      opacity: [0, 1],
      duration: 600,
      delay,
      easing: 'easeOutBack'
    });
  }
};

export const slideInLeft = (element: string | HTMLElement, delay = 0) => {
  if (typeof window !== 'undefined' && window.anime) {
    window.anime({
      targets: element,
      translateX: [-50, 0],
      opacity: [0, 1],
      duration: 700,
      delay,
      easing: 'easeOutCubic'
    });
  }
};

export const staggerAnimation = (elements: string, delay = 100) => {
  if (typeof window !== 'undefined' && window.anime) {
    window.anime({
      targets: elements,
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 600,
      delay: window.anime.stagger(delay),
      easing: 'easeOutCubic'
    });
  }
};

export const pulseGlow = (element: string | HTMLElement) => {
  if (typeof window !== 'undefined' && window.anime) {
    window.anime({
      targets: element,
      scale: [1, 1.05, 1],
      duration: 2000,
      loop: true,
      easing: 'easeInOutSine'
    });
  }
};