import { Menu } from 'obsidian';

const submenuByMenu = new WeakMap<Menu, Menu>();

export function getWeaveOperationsSubmenu(menu: Menu): Menu {
  const existing = submenuByMenu.get(menu);
  if (existing) return existing;

  let created: Menu | null = null;

  menu.addItem((item) => {
    item.setTitle('Weave 操作');
    item.setIcon('brain');
    created = (item as any).setSubmenu() as Menu;
  });

  const submenu = created ?? new Menu();
  submenuByMenu.set(menu, submenu);
  return submenu;
}
