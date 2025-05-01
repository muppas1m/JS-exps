export function createManagedInterval(task, interval, options = {}, ...taskArgs) {
    if(!task || typeof(task)!=='function') return;
    const { clearPrevious = true, immediate = false } = options;
    let intervalId;
    
    if (clearPrevious) {
        clearInterval(intervalId);
    }
    
    if (immediate) task(...taskArgs);
    intervalId = setInterval(task, interval, ...taskArgs);
    
    return {
        id: intervalId,
        clear: () => clearInterval(intervalId)
    };
}
