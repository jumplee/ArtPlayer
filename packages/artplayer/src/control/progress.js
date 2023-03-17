import { query, clamp, append, setStyle, setStyles, secondToTime, includeFromEvent, isMobile } from '../utils';

export function getPosFromEvent(art, event) {
    const { $progress } = art.template;
    const { left } = $progress.getBoundingClientRect();
    const eventLeft = isMobile ? event.touches[0].clientX : event.pageX;
    const width = clamp(eventLeft - left, 0, $progress.clientWidth);
    const second = (width / $progress.clientWidth) * art.duration;
    const time = secondToTime(second);
    const percentage = clamp(width / $progress.clientWidth, 0, 1);
    return { second, time, width, percentage };
}

/**
 * 是否允许设置当前时间，
 * 当设置观看范围或者禁止前进或后退时进行判断
 * @param art
 * @param seekTime
 * @returns {boolean}
 */
function isAllowChangeCurrentTime(art, seekTime) {
    if (art.option.progress) {
        if (typeof art.option.progress.allowDrag === 'undefined') {
            return true;
        } else {
            if (art.option.progress.allowDrag === 'all') {
                return true;
            } else if (art.option.progress.allowDrag === 'forward') {
                if (seekTime - art.currentTime < 0) {
                    return false;
                } else {
                    return true;
                }
            } else if (art.option.progress.allowDrag === 'back') {
                if (seekTime - art.currentTime > 0) {
                    return false;
                } else {
                    return true;
                }
            } else if (art.option.progress.allowDrag === 'none') {
                return false;
            }
        }
    } else {
        // 没有配置参数就是可以自由拖拽
        return true;
    }
}
export function setCurrentTime(art, event) {
    // console.log(`---setCurrentTime---`)
    let { second, percentage } = getPosFromEvent(art, event);
    // 翻转时计算逻辑不同
    if (art.isRotate) {
        percentage = event.touches[0].clientY / art.height;
        second = percentage * art.duration;
    }
    if (isAllowChangeCurrentTime(art, second)) {
        art.emit('setBar', 'played', percentage);
        art.seek = second;
    } else {
        // 阻止后触发回调，可以在回调中提醒或其他操作
        if (art.option.progress && art.option.progress.onDragRefuse) {
            art.option.progress.onDragRefuse(art);
        }
    }
}

export default function progress(options) {
    return (art) => {
        const { icons, option, proxy } = art;

        return {
            ...options,
            html: `
                <div class="art-control-progress-inner">
                    <div class="art-progress-loaded"></div>
                    <div class="art-progress-played"></div>
                    <div class="art-progress-highlight"></div>
                    <div class="art-progress-indicator"></div>
                    <div class="art-progress-tip"></div>
                </div>
            `,
            mounted: ($control) => {
                let isDroging = false;
                const $loaded = query('.art-progress-loaded', $control);
                const $played = query('.art-progress-played', $control);
                const $highlight = query('.art-progress-highlight', $control);
                const $indicator = query('.art-progress-indicator', $control);
                const $tip = query('.art-progress-tip', $control);

                const {
                    PROGRESS_HEIGHT,
                    INDICATOR_SIZE,
                    INDICATOR_SIZE_ICON,
                    INDICATOR_SIZE_MOBILE,
                    INDICATOR_SIZE_MOBILE_ICON,
                } = art.constructor;

                setStyle($control, 'height', `${PROGRESS_HEIGHT}px`);
                setStyle($played, 'backgroundColor', 'var(--theme)');

                let indicatorSize = INDICATOR_SIZE;

                if (icons.indicator) {
                    indicatorSize = INDICATOR_SIZE_ICON;
                    append($indicator, icons.indicator);
                } else {
                    setStyles($indicator, {
                        backgroundColor: 'var(--theme)',
                    });
                }

                if (isMobile) {
                    indicatorSize = INDICATOR_SIZE_MOBILE;
                    if (icons.indicator) {
                        indicatorSize = INDICATOR_SIZE_MOBILE_ICON;
                    }
                }

                setStyles($indicator, {
                    left: `-${indicatorSize / 2}px`,
                    width: `${indicatorSize}px`,
                    height: `${indicatorSize}px`,
                });

                function showHighlight(event) {
                    const { width } = getPosFromEvent(art, event);
                    const { text } = event.target.dataset;
                    $tip.innerHTML = text;
                    const tipWidth = $tip.clientWidth;
                    if (width <= tipWidth / 2) {
                        setStyle($tip, 'left', 0);
                    } else if (width > $control.clientWidth - tipWidth / 2) {
                        setStyle($tip, 'left', `${$control.clientWidth - tipWidth}px`);
                    } else {
                        setStyle($tip, 'left', `${width - tipWidth / 2}px`);
                    }
                }

                function showTime(event) {
                    const { width, time } = getPosFromEvent(art, event);
                    $tip.innerHTML = time;
                    const tipWidth = $tip.clientWidth;
                    if (width <= tipWidth / 2) {
                        setStyle($tip, 'left', 0);
                    } else if (width > $control.clientWidth - tipWidth / 2) {
                        setStyle($tip, 'left', `${$control.clientWidth - tipWidth}px`);
                    } else {
                        setStyle($tip, 'left', `${width - tipWidth / 2}px`);
                    }
                }

                function setBar(type, percentage) {
                    if (type === 'loaded') {
                        setStyle($loaded, 'width', `${percentage * 100}%`);
                    }

                    if (type === 'played') {
                        setStyle($played, 'width', `${percentage * 100}%`);
                        setStyle($indicator, 'left', `calc(${percentage * 100}% - ${indicatorSize / 2}px)`);
                    }
                }

                art.on('video:loadedmetadata', () => {
                    for (let index = 0; index < option.highlight.length; index++) {
                        const item = option.highlight[index];
                        const left = (clamp(item.time, 0, art.duration) / art.duration) * 100;
                        append(
                            $highlight,
                            `<span data-text="${item.text}" data-time="${item.time}" style="left: ${left}%"></span>`,
                        );
                    }
                });

                setBar('loaded', art.loaded);

                art.on('setBar', (type, percentage) => {
                    setBar(type, percentage);
                });

                art.on('video:progress', () => {
                    setBar('loaded', art.loaded);
                });

                art.on('video:timeupdate', () => {
                    setBar('played', art.played);
                });

                art.on('video:ended', () => {
                    setBar('played', 1);
                });

                if (!isMobile) {
                    proxy($control, 'click', (event) => {
                        if (event.target !== $indicator) {
                            setCurrentTime(art, event);
                        }
                    });

                    proxy($control, 'mousemove', (event) => {
                        setStyle($tip, 'display', 'block');
                        if (includeFromEvent(event, $highlight)) {
                            showHighlight(event);
                        } else {
                            showTime(event);
                        }
                    });

                    proxy($control, 'mouseleave', () => {
                        setStyle($tip, 'display', 'none');
                    });

                    proxy($control, 'mousedown', () => {
                        isDroging = true;
                    });

                    proxy(document, 'mousemove', (event) => {
                        if (isDroging) {
                            const { percentage } = getPosFromEvent(art, event);
                            setBar('played', percentage);
                        }
                    });

                    proxy(document, 'mouseup', (event) => {
                        if (isDroging) {
                            isDroging = false;
                            setCurrentTime(art, event);
                        }
                    });
                }
            },
        };
    };
}
