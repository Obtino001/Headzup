/* ========================================================================
   Boost Custom Filter - Web Component
   Handles Mobile Drawer, Desktop Popovers, AJAX Filtering & Infinite Scroll
   ======================================================================== */

class BoostFilter extends HTMLElement {
    constructor() {
        super();
        this.GRID_SELECTOR = '#CollectionLoop, .grid-outer, #ProductGridContainer, .collection-grid';

        // Infinite scroll state
        this.currentPage = 1;
        this.totalPages = 1;
        this.isLoadingMore = false;
        this.infiniteObserver = null;
    }

    connectedCallback() {
        // Cache Elements
        this.mobileTrigger = this.querySelector('.boost-mobile-trigger');
        this.drawerContent = this.querySelector('.boost-drawer-content');
        this.drawerOverlay = this.querySelector('.boost-drawer-overlay');
        this.drawerClose = this.querySelector('.boost-drawer-close');
        this.filterItems = this.querySelectorAll('.boost-filter-item');
        this.sortSelects = this.querySelectorAll('.boost-sort-select');
        this.filterForm = this.querySelector('#BoostFilterForm');

        // Bind Methods
        this.openDrawer = this.openDrawer.bind(this);
        this.closeDrawer = this.closeDrawer.bind(this);
        this.submitForm = this.submitForm.bind(this);
        this.closeAllPopovers = this.closeAllPopovers.bind(this);
        this.onBodyClick = this.onBodyClick.bind(this);

        // Setup Event Listeners
        this.initListeners();
        this.initInfiniteScroll();
        this.renderActiveFilters();
        this.applyDefaultFilters();
    }

    disconnectedCallback() {
        document.removeEventListener('click', this.onBodyClick);
        if (this.infiniteObserver) {
            this.infiniteObserver.disconnect();
            this.infiniteObserver = null;
        }
    }

    initListeners() {
        // Mobile Drawer Triggers
        if (this.mobileTrigger) this.mobileTrigger.addEventListener('click', this.openDrawer);
        if (this.drawerClose) this.drawerClose.addEventListener('click', this.closeDrawer);
        if (this.drawerOverlay) this.drawerOverlay.addEventListener('click', this.closeDrawer);

        // Dropdown / Accordion Logic
        this.filterItems.forEach(item => {
            const labelBtn = item.querySelector('.boost-filter-label');
            const dropdown = item.querySelector('.boost-filter-dropdown');

            if (labelBtn && dropdown) {
                labelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isMobile = window.innerWidth < 768;

                    if (isMobile) {
                        // Accordion Mode (Mobile)
                        const isOpen = item.classList.contains('is-open');
                        this.filterItems.forEach(other => {
                            other.classList.remove('is-open');
                            other.querySelector('.boost-filter-dropdown')?.classList.remove('is-open');
                            other.querySelector('.boost-filter-label')?.setAttribute('aria-expanded', 'false');
                        });

                        if (!isOpen) {
                            item.classList.add('is-open');
                            dropdown.classList.add('is-open');
                            labelBtn.setAttribute('aria-expanded', 'true');
                        }
                    } else {
                        // Popover Mode (Desktop)
                        const isOpen = dropdown.classList.contains('is-open');
                        this.closeAllPopovers();
                        if (!isOpen) {
                            dropdown.classList.add('is-open');
                            labelBtn.setAttribute('aria-expanded', 'true');
                        }
                    }
                });

                dropdown.addEventListener('click', (e) => {
                    e.stopPropagation();
                });

                // Handle "ANVEND" (Apply) button
                const applyBtn = dropdown.querySelector('[data-apply-btn]');
                if (applyBtn) {
                    applyBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.submitForm();
                        this.closeAllPopovers();
                    });
                }

                // Handle "NULSTIL" (Clear) button per filter
                const clearBtn = dropdown.querySelector('[data-clear-btn]');
                if (clearBtn) {
                    clearBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.clearSingleFilter(dropdown);
                    });
                }

                // Handle Mobile "< BACK" button
                const backBtn = dropdown.querySelector('.boost-mobile-back');
                if (backBtn) {
                    backBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        item.classList.remove('is-open');
                        labelBtn.setAttribute('aria-expanded', 'false');
                    });
                }
            }
        });

        // Close desktop popovers on outside click
        // Only add if not already added to avoid duplicates
        document.removeEventListener('click', this.onBodyClick);
        document.addEventListener('click', this.onBodyClick);

        // Form Submissions
        if (this.filterForm) {
            this.filterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitForm();
            });

            if (this.sortSelects) {
                this.sortSelects.forEach(select => {
                    select.addEventListener('change', (e) => this.submitForm(e));
                });
            }
        }

        // Intercept "ryd alle" (Clear All) links - handle via AJAX instead of full reload
        this.querySelectorAll('.boost-drawer-clear-all, .boost-link-clear').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearAllFilters();
            });
        });

        this.initPriceSliders();
    }

    /* ------------------------------------------------------------------
       CLEAR FILTER LOGIC
    ------------------------------------------------------------------ */
    applyDefaultFilters() {
        const params = new URLSearchParams(window.location.search);
        const sessionKey = 'boost_default_stock_' + window.location.pathname;

        // Check if availability filter is missing AND we haven't auto-applied it this session
        if (!params.has('filter.v.availability') && !sessionStorage.getItem(sessionKey)) {
            
            // Find the "In Stock" checkbox (Value is usually '1' or 'In stock' depending on language settings)
            // If it doesn't trigger, inspect your checkbox to see what the exact value="" attribute is.
            const inStockCheckbox = this.filterForm?.querySelector('input[name="filter.v.availability"][value="1"]');

            if (inStockCheckbox) {
                inStockCheckbox.checked = true;              // 1. Visually check the box
                sessionStorage.setItem(sessionKey, 'true');  // 2. Mark it so we don't trap the user if they click "Clear All"
                this.submitForm();                           // 3. Trigger your native AJAX fetch seamlessly
            }
        }
    }

    clearSingleFilter(dropdown) {
        // Uncheck all checkboxes in this dropdown
        dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Reset price inputs to defaults
        const minInput = dropdown.querySelector('.boost-price-input-min');
        const maxInput = dropdown.querySelector('.boost-price-input-max');
        const rangeMin = dropdown.querySelector('.boost-price-range-min');
        const rangeMax = dropdown.querySelector('.boost-price-range-max');

        if (minInput) minInput.value = minInput.min || '0';
        if (maxInput) maxInput.value = maxInput.max || maxInput.placeholder;
        if (rangeMin) rangeMin.value = rangeMin.min || '0';
        if (rangeMax) rangeMax.value = rangeMax.max;

        // Update price slider progress bar
        const progress = dropdown.querySelector('.boost-price-slider-progress');
        if (progress) {
            progress.style.left = '0%';
            progress.style.right = '0%';
        }

        this.submitForm();
        this.closeAllPopovers();
    }

    clearAllFilters() {
        if (!this.filterForm) return;

        // Uncheck all checkboxes
        this.filterForm.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Reset all price inputs
        this.filterForm.querySelectorAll('.boost-price-input-min').forEach(input => {
            input.value = input.min || '0';
        });
        this.filterForm.querySelectorAll('.boost-price-input-max').forEach(input => {
            input.value = input.max || input.placeholder;
        });
        this.filterForm.querySelectorAll('.boost-price-range-min').forEach(input => {
            input.value = input.min || '0';
        });
        this.filterForm.querySelectorAll('.boost-price-range-max').forEach(input => {
            input.value = input.max;
        });

        this.submitForm();
        this.closeAllPopovers();
        this.closeDrawer();
    }

    /* ------------------------------------------------------------------
       ACTIVE FILTER TAGS (Desktop)
    ------------------------------------------------------------------ */

    renderActiveFilters() {
        const container = document.getElementById('BoostActiveFilters');
        if (!container) return;

        const tags = [];

        if (this.filterForm) {
            this.filterForm.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                const label = cb.closest('label');
                const textEl = label ? label.querySelector('.boost-checkbox-text') : null;
                const text = textEl ? textEl.textContent.replace(/\s*\(.*\)\s*$/, '').trim() : cb.value;
                tags.push({
                    name: cb.name,
                    value: cb.value,
                    label: text
                });
            });
        }

        if (tags.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        let html = '';
        tags.forEach(tag => {
            html += `<button class="boost-active-tag" data-filter-name="${tag.name}" data-filter-value="${tag.value}" type="button">
                ${tag.label}
              <svg aria-hidden="true" focusable="false" role="presentation" class="icon icon-cancel" viewBox="0 0 24 24"><path d="M6.758 17.243 12.001 12m5.243-5.243L12 12m0 0L6.758 6.757M12.001 12l5.243 5.243" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            </button>`;
        });
        html += `<button class="boost-clear-all-btn" type="button">Nulstil alle</button>`;
        container.innerHTML = html;

        // Add click handlers for tag removal
        container.querySelectorAll('.boost-active-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                const name = tag.dataset.filterName;
                const value = tag.dataset.filterValue;
                const checkbox = this.filterForm?.querySelector(`input[type="checkbox"][name="${name}"][value="${value}"]`);
                if (checkbox) {
                    checkbox.checked = false;
                    this.submitForm();
                }
            });
        });

        // Clear all button
        const clearAllBtn = container.querySelector('.boost-clear-all-btn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.clearAllFilters());
        }
    }

    /* ------------------------------------------------------------------
       PRICE SLIDERS
    ------------------------------------------------------------------ */

    initPriceSliders() {
        const priceWrappers = this.querySelectorAll('.boost-price-range');
        priceWrappers.forEach(wrapper => {
            const rangeMin = wrapper.querySelector('.boost-price-range-min');
            const rangeMax = wrapper.querySelector('.boost-price-range-max');
            const inputMin = wrapper.querySelector('.boost-price-input-min');
            const inputMax = wrapper.querySelector('.boost-price-input-max');
            const progress = wrapper.querySelector('.boost-price-slider-progress');
            if (!rangeMin || !rangeMax || !inputMin || !inputMax || !progress) return;

            const updateProgress = () => {
                const min = parseFloat(rangeMin.value) || 0;
                const max = parseFloat(rangeMax.value) || 0;
                const absoluteMax = parseFloat(rangeMin.max) || 1;
                const left = (min / absoluteMax) * 100;
                const right = 100 - (max / absoluteMax) * 100;
                progress.style.left = left + '%';
                progress.style.right = right + '%';
            };

            updateProgress();

            rangeMin.addEventListener('input', () => {
                let min = parseFloat(rangeMin.value);
                let max = parseFloat(rangeMax.value);
                if (max - min < 0) {
                    rangeMin.value = max;
                    min = max;
                }
                inputMin.value = min;
                updateProgress();
            });

            rangeMax.addEventListener('input', () => {
                let min = parseFloat(rangeMin.value);
                let max = parseFloat(rangeMax.value);
                if (max - min < 0) {
                    rangeMax.value = min;
                    max = min;
                }
                inputMax.value = max;
                updateProgress();
            });

            const onInputBoxChange = () => {
                let min = parseFloat(inputMin.value) || 0;
                let max = parseFloat(inputMax.value) || parseFloat(rangeMax.max);
                const absoluteMax = parseFloat(rangeMax.max);
                if (min < 0) min = 0;
                if (max > absoluteMax) max = absoluteMax;
                if (min > max) { let temp = min; min = max; max = temp; }

                inputMin.value = min;
                inputMax.value = max;
                rangeMin.value = min;
                rangeMax.value = max;
                updateProgress();
            };

            inputMin.addEventListener('change', onInputBoxChange);
            inputMax.addEventListener('change', onInputBoxChange);

            // Fetch update on drop/change
            rangeMin.addEventListener('change', this.submitForm);
            rangeMax.addEventListener('change', this.submitForm);
            inputMin.addEventListener('change', this.submitForm);
            inputMax.addEventListener('change', this.submitForm);
        });
    }

    /* ------------------------------------------------------------------
       DRAWER & POPOVER CONTROLS
    ------------------------------------------------------------------ */

    onBodyClick(e) {
        if (window.innerWidth >= 768) {
            if (!e.target.closest('boost-filter')) {
                this.closeAllPopovers();
            }
        }
    }

    openDrawer() {
        this.drawerContent?.classList.add('is-active');
        this.drawerOverlay?.classList.add('is-active');
        document.body.style.overflow = 'hidden';
    }

    closeDrawer() {
        this.drawerContent?.classList.remove('is-active');
        this.drawerOverlay?.classList.remove('is-active');
        document.body.style.overflow = '';

        setTimeout(() => {
            this.filterItems.forEach(item => {
                item.classList.remove('is-open');
                item.querySelector('.boost-filter-dropdown')?.classList.remove('is-open');
                item.querySelector('.boost-filter-label')?.setAttribute('aria-expanded', 'false');
            });
        }, 300);
    }

    closeAllPopovers() {
        this.filterItems.forEach(item => {
            const drop = item.querySelector('.boost-filter-dropdown');
            const btn = item.querySelector('.boost-filter-label');
            if (drop) drop.classList.remove('is-open');
            if (btn) btn.setAttribute('aria-expanded', 'false');
        });
    }

    /* ------------------------------------------------------------------
       FORM SUBMISSION & AJAX FILTERING
    ------------------------------------------------------------------ */

    getSectionId() {
        const parentSection = this.closest('.shopify-section');
        let sectionId = parentSection ? parentSection.id.replace('shopify-section-', '') : null;
        if (!sectionId) {
            const cc = document.querySelector('collection-component[data-section-id]');
            if (cc) sectionId = cc.dataset.sectionId;
        }
        return sectionId;
    }

    buildFilterParams() {
        if (!this.filterForm) return new URLSearchParams();

        const formData = new FormData(this.filterForm);
        const searchParams = new URLSearchParams();

        // Collect all form entries, properly handling multiple values for the same key
        for (const [key, value] of formData.entries()) {
            if (!value && value !== '0') continue; // Skip truly empty values

            // Skip price range values that are at their defaults (no actual filter)
            if (key.includes('filter.v.price.gte')) {
                const input = this.filterForm.querySelector(`[name="${key}"]`);
                if (input && parseFloat(value) === 0) continue;
            }
            if (key.includes('filter.v.price.lte')) {
                const input = this.filterForm.querySelector(`[name="${key}"]`);
                if (input && parseFloat(value) === parseFloat(input.max)) continue;
            }

            searchParams.append(key, value);
        }

        // Capture Sort value from Mobile dropdown (outside the form)
        const mobileSort = this.querySelector('.boost-mobile-sort-select');
        if (mobileSort && window.innerWidth < 768) {
            searchParams.set('sort_by', mobileSort.value);
        }

        return searchParams;
    }

    submitForm(e) {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!this.filterForm) return;

        const searchParams = this.buildFilterParams();

        // Create a fully qualified absolute URL
        const absoluteUrl = new URL(window.location.pathname, window.location.origin);
        absoluteUrl.search = searchParams.toString();
        const url = absoluteUrl.toString();

        let fetchUrl = url;
        const sectionId = this.getSectionId();
        if (sectionId) {
            fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + `section_id=${sectionId}`;
        }

        let gridContainer = document.querySelector(this.GRID_SELECTOR);
        if (!gridContainer) {
            const productsWrap = document.querySelector('.collection__products');
            if (productsWrap) gridContainer = productsWrap;
        }

        // Handle Mobile Drawer close
        const drawerWasOpen = this.drawerContent && this.drawerContent.classList.contains('is-active');
        if (drawerWasOpen) {
            this.closeDrawer();
        }

        // Loading state
        if (gridContainer) gridContainer.style.opacity = '0.5';
        if (!drawerWasOpen) {
            this.style.opacity = '0.5';
        }

        const fetchStartTime = Date.now();

        fetch(fetchUrl)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.text();
            })
            .then(html => {
                const processHTML = () => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    // 1. Update Grid
                    const GRID_WRAPPERS = ['#CollectionLoop', '.grid-outer', '#ProductGridContainer', '.collection-grid', '.collection__products'];
                    let currentGrid = null;
                    let newGrid = null;

                    for (const selector of GRID_WRAPPERS) {
                        currentGrid = document.querySelector(selector);
                        newGrid = doc.querySelector(selector);
                        if (currentGrid && newGrid) break;
                    }

                    if (currentGrid && newGrid) {
                        currentGrid.innerHTML = newGrid.innerHTML;
                        this.revealGridItems(currentGrid);
                    } else {
                        console.warn('Grid not found in response, falling back to full reload');
                        window.location.href = url;
                        return;
                    }

                    // 2. Update Filters
                    const newFilter = doc.querySelector('boost-filter');
                    if (newFilter) {
                        this.innerHTML = newFilter.innerHTML;
                        this.connectedCallback(); // Re-initialize everything
                    }

                    // 3. Update URL (with guard to avoid redundant hits/pixel errors)
                    if (window.location.href !== url) {
                        window.history.replaceState({ path: url }, '', url);
                    }

                    // 4. Reset infinite scroll for the new filter results
                    this.resetInfiniteScroll(doc);

                    // Remove Loading state
                    if (gridContainer) gridContainer.style.opacity = '1';
                    this.style.opacity = '1';
                };

                const elapsed = Date.now() - fetchStartTime;
                const requiredDelay = drawerWasOpen ? 350 : 0;
                if (elapsed < requiredDelay) {
                    setTimeout(processHTML, requiredDelay - elapsed);
                } else {
                    processHTML();
                }
            })
            .catch(error => {
                console.error('Filtering error:', error);
                // On error, let the form submit naturally if it can, or just reset opacity
                if (gridContainer) gridContainer.style.opacity = '1';
                this.style.opacity = '1';
                
                // Fallback to location change if it looks like a real failure
                if (error.message.includes('404')) {
                    window.location.href = url;
                }
            });
    }

    revealGridItems(grid) {
        // Defeat AOS animation blocker
        grid.querySelectorAll('[data-aos]').forEach(el => {
            el.classList.add('aos-animate');
            el.style.opacity = '1';
            el.style.transform = 'none';
            el.style.visibility = 'visible';
        });

        // Force lazy images to load
        grid.querySelectorAll('img[data-srcset], img[data-src], img.lazyload').forEach(img => {
            if (img.dataset.srcset) img.srcset = img.dataset.srcset;
            if (img.dataset.src) img.src = img.dataset.src;
            img.classList.remove('lazyload');
            img.classList.add('lazyloaded');
        });

        // Refresh theme components
        if (typeof AOS !== 'undefined' && AOS !== null) AOS.refreshHard();
        document.dispatchEvent(new CustomEvent('page:loaded'));
        window.dispatchEvent(new Event('resize'));

        // Force all items visible
        grid.querySelectorAll('.grid-item, .grid__item, [data-aos], .grid-product, [class*="product"]').forEach(item => {
            item.style.opacity = '1';
            item.style.visibility = 'visible';
            item.style.transform = 'none';
            item.style.animation = 'none';
            item.classList.add('aos-animate');
        });
    }

    /* ------------------------------------------------------------------
       INFINITE SCROLL
    ------------------------------------------------------------------ */

    initInfiniteScroll() {
        const gridOuter = document.querySelector('.grid-outer[data-products-grid]');
        if (!gridOuter) return;

        this.totalPages = parseInt(gridOuter.dataset.totalPages) || 1;
        this.currentPage = 1;

        if (this.totalPages <= 1) return;

        const sentinel = document.querySelector('.boost-infinite-trigger');
        if (!sentinel) return;

        // Disconnect any previous observer
        if (this.infiniteObserver) this.infiniteObserver.disconnect();

        this.infiniteObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoadingMore && this.currentPage < this.totalPages) {
                    this.loadNextPage();
                }
            });
        }, { rootMargin: '400px' });

        this.infiniteObserver.observe(sentinel);
    }

    resetInfiniteScroll(doc) {
        // After a filter change, reset page tracking and re-initialize infinite scroll
        this.currentPage = 1;
        this.isLoadingMore = false;

        if (this.infiniteObserver) {
            this.infiniteObserver.disconnect();
            this.infiniteObserver = null;
        }

        // Get new total pages from the fetched HTML
        const newGridOuter = doc.querySelector('.grid-outer[data-products-grid]');
        if (newGridOuter) {
            this.totalPages = parseInt(newGridOuter.dataset.totalPages) || 1;

            // Update the data attribute on the current page
            const currentGridOuter = document.querySelector('.grid-outer[data-products-grid]');
            if (currentGridOuter) {
                currentGridOuter.dataset.totalPages = this.totalPages;
            }
        }

        // Recreate or show/hide the sentinel
        let sentinel = document.querySelector('.boost-infinite-trigger');

        if (this.totalPages > 1) {
            if (!sentinel) {
                // Create sentinel if it doesn't exist
                sentinel = document.createElement('div');
                sentinel.className = 'boost-infinite-trigger';
                const gridOuter = document.querySelector('.grid-outer[data-products-grid]');
                const loadingEl = document.querySelector('.boost-infinite-loading');
                if (gridOuter && loadingEl) {
                    gridOuter.insertBefore(sentinel, loadingEl);
                } else if (gridOuter) {
                    gridOuter.appendChild(sentinel);
                }
            }
            sentinel.style.display = '';

            // Re-observe
            this.infiniteObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.isLoadingMore && this.currentPage < this.totalPages) {
                        this.loadNextPage();
                    }
                });
            }, { rootMargin: '400px' });

            this.infiniteObserver.observe(sentinel);
        } else {
            // Only 1 page of results, hide sentinel
            if (sentinel) sentinel.style.display = 'none';
        }
    }

    loadNextPage() {
        if (this.isLoadingMore || this.currentPage >= this.totalPages) return;

        this.isLoadingMore = true;
        const nextPage = this.currentPage + 1;

        const loadingEl = document.querySelector('.boost-infinite-loading');
        if (loadingEl) loadingEl.style.display = 'flex';

        // Build URL: current location (with filters) + page param
        const url = new URL(window.location.href);
        url.searchParams.set('page', nextPage);

        let fetchUrl = url.toString();
        const sectionId = this.getSectionId();
        if (sectionId) {
            fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + `section_id=${sectionId}`;
        }

        fetch(fetchUrl)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
            })
            .then(html => {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const newGrid = doc.querySelector('#CollectionLoop');
                const currentGrid = document.querySelector('#CollectionLoop');
                if (newGrid && currentGrid) {
                    // Append only the product items (children of the new grid)
                    const fragment = document.createDocumentFragment();
                    Array.from(newGrid.children).forEach(child => {
                        fragment.appendChild(child.cloneNode(true));
                    });
                    currentGrid.appendChild(fragment);

                    // Reveal appended items
                    this.revealGridItems(currentGrid);
                }

                this.currentPage = nextPage;

                // ---> ADD THIS LINE TO UPDATE THE URL BAR <---
                if (window.location.href !== url.toString()) {
                    window.history.replaceState({ path: url.toString() }, '', url.toString());
                }

                // Check if we've reached the last page
                if (this.currentPage >= this.totalPages) {
                    const sentinel = document.querySelector('.boost-infinite-trigger');
                    if (sentinel) sentinel.style.display = 'none';
                    if (this.infiniteObserver) this.infiniteObserver.disconnect();
                }

                if (loadingEl) loadingEl.style.display = 'none';
                this.isLoadingMore = false;
            })
            .catch(err => {
                console.error('Infinite scroll error:', err);
                if (loadingEl) loadingEl.style.display = 'none';
                this.isLoadingMore = false;
            });
    }
}

customElements.define('boost-filter', BoostFilter);
