import type { Accessory } from './storage';

/** Original SVG frames bundled locally; no product-photo requests are needed. */
export const catalog: Accessory[] = [
  {
    id: 'everyday',
    name: 'The Everyday',
    image: '/accessories/everyday.svg',
    source: 'catalog',
    color: 'Warm tortoise',
    shape: 'Oval',
  },
  {
    id: 'weekender',
    name: 'The Weekender',
    image: '/accessories/weekender.svg',
    source: 'catalog',
    color: 'Midnight black',
    shape: 'Rectangle',
  },
  {
    id: 'soft-focus',
    name: 'Soft Focus',
    image: '/accessories/soft-focus.svg',
    source: 'catalog',
    color: 'Champagne gold',
    shape: 'Round',
  },
  {
    id: 'after-hours',
    name: 'After Hours',
    image: '/accessories/after-hours.svg',
    source: 'catalog',
    color: 'Dark espresso',
    shape: 'Cat-eye',
  },
  {
    id: 'aviator',
    name: 'The Aviator',
    image: '/accessories/aviator.svg',
    source: 'catalog',
    color: 'Brushed gold',
    shape: 'Aviator',
  },
  {
    id: 'rosewater',
    name: 'Rosewater',
    image: '/accessories/rosewater.svg',
    source: 'catalog',
    color: 'Translucent rose',
    shape: 'Oval',
  },
];
