class SearchEngineService {
  static isLikelyUrl(input) {
    const trimmed = input.trim();
    if (trimmed.startsWith('localhost') || trimmed.startsWith('127.0.0.1')) return true;
    if (/^(\/|[a-zA-Z]:[/\\]|~[/\\])/.test(trimmed)) return true;
    if (/\.(html?|xhtml|shtml|xml|svg|pdf|txt)$/i.test(trimmed) && !/\s/.test(trimmed)) return true;
    if (/^[a-zA-Z]+:\/\//.test(trimmed)) return true;
    const urlPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
    return urlPattern.test(trimmed);
  }

  static resolveInputToUrl(input, defaultEngine = 'duckduckgo') {
    const trimmed = input.trim();
    if (trimmed.startsWith('freedom://')) return trimmed;
    if (trimmed.startsWith('file://')) return trimmed;
    if (/^(\/|[a-zA-Z]:[/\\])/.test(trimmed)) {
      const normalized = trimmed.replace(/\\/g, '/');
      return `file://${normalized.startsWith('/') ? '' : '/'}${normalized}`;
    }
    if (this.isLikelyUrl(trimmed)) {
      if (!/^[a-zA-Z]+:\/\//.test(trimmed)) {
        return `https://${trimmed}`;
      }
      return trimmed;
    }
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
}

console.log("Path with space:", SearchEngineService.isLikelyUrl("/home/royalxvii/Рабочий стол/NeonPyatov.html"));
console.log("Resolved path with space:", SearchEngineService.resolveInputToUrl("/home/royalxvii/Рабочий стол/NeonPyatov.html"));
console.log("Resolved relative with space:", SearchEngineService.resolveInputToUrl("NeonPyatov.html"));
console.log("Resolved relative with space in name:", SearchEngineService.resolveInputToUrl("my page.html"));
