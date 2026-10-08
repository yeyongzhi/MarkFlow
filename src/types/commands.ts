import type { Component } from 'vue'
export interface AppCommand { id: string; label: string; menu: string; icon: Component; shortcut?: string; disabled?: boolean; run: () => unknown }
export const commandMenus = ['文件', '编辑', '段落', '视图', '导出', '帮助']
