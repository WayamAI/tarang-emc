"use client";

import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Settings, SunMedium } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useTheme } from "@/context/theme-context";
import { APP } from "@/lib/app";
import {
  SIDEBAR_GROUPS,
  groupForPath,
  itemsInGroup,
  navItemForPath,
  type NavGroup,
  type NavItem,
} from "@/lib/navigation";

import { Logo } from "./logo";
import {
  SidebarGroupTrigger,
  SidebarItem,
  SidebarTreeBranch,
  SidebarTreeItem,
  SidebarTreeLabel,
} from "./sidebar-item";

/**
 * Primary navigation. Top-level destinations stay visible; everything else
 * lives in a collapsible tree so the rail is not a 25-item list.
 *
 * Collapsed (68px): group icons. Hover reveals a flyout of children.
 * Expanded / mobile drawer: accordion tree with branch lines.
 */
export function Sidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const { isDark, toggleTheme } = useTheme();
  const activeItem = navItemForPath(pathname);
  const activeGroup = groupForPath(pathname);
  const showExpanded = expanded || open;

  function isGroupOpen(id: string) {
    if (typeof openIds[id] === "boolean") return openIds[id];
    return id === activeGroup?.id;
  }

  function toggleGroup(id: string) {
    setOpenIds((prev) => ({ ...prev, [id]: !isGroupOpen(id) }));
  }

  function onGroupClick(group: NavGroup) {
    if (!showExpanded) {
      setExpanded(true);
      setOpenIds((prev) => ({ ...prev, [group.id]: true }));
      return;
    }
    toggleGroup(group.id);
  }

  return (
    <aside
      aria-label="Primary"
      data-expanded={showExpanded}
      className={[
        "flex h-full shrink-0 flex-col border-r border-muted bg-container",
        "transition-[width,transform] duration-200 ease-out",
        "fixed inset-y-0 left-0 z-50 lg:relative lg:z-30 lg:translate-x-0",
        showExpanded ? "w-[252px]" : "w-[68px]",
        open
          ? "translate-x-0"
          : "-translate-x-full pointer-events-none lg:pointer-events-auto lg:translate-x-0",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-14 shrink-0 items-center border-b border-muted",
          showExpanded ? "gap-2.5 px-4" : "justify-center",
        ].join(" ")}
      >
        <Logo wordmark={showExpanded} />
      </div>

      <nav
        aria-label="Main navigation"
        className={[
          "min-h-0 flex-1 py-3",
          showExpanded
            ? "overflow-y-auto overflow-x-hidden overscroll-contain pr-1 pl-3 [scrollbar-gutter:stable]"
            : "overflow-visible px-[14px]",
        ].join(" ")}
      >
        <ul className="flex flex-col gap-1.5">
          {SIDEBAR_GROUPS.map((group) => {
            const items = itemsInGroup(group);
            const isLeaf = items.length === 1;
            const childActive = items.some((item) => item.href === activeItem?.href);

            if (isLeaf) {
              const item = items[0];
              return (
                <li key={group.id}>
                  <SidebarItem
                    icon={item.icon}
                    label={item.label}
                    href={item.href}
                    active={activeItem?.href === item.href}
                    expanded={showExpanded}
                    onNavigate={onClose}
                  />
                </li>
              );
            }

            const openGroup = isGroupOpen(group.id);

            return (
              <li
                key={group.id}
                className={showExpanded ? "relative overflow-hidden" : "group relative"}
              >
                <SidebarGroupTrigger
                  icon={group.icon}
                  label={group.label}
                  active={childActive}
                  expanded={showExpanded}
                  open={showExpanded && openGroup}
                  onClick={() => onGroupClick(group)}
                />

                {showExpanded && openGroup ? (
                  <SidebarTreeBranch>
                    <GroupLeaves
                      group={group}
                      items={items}
                      activeHref={activeItem?.href}
                      onNavigate={onClose}
                    />
                  </SidebarTreeBranch>
                ) : null}

                {!showExpanded ? (
                  <CollapsedFlyout
                    group={group}
                    items={items}
                    activeHref={activeItem?.href}
                    onNavigate={onClose}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={[
          "flex shrink-0 flex-col gap-1.5 border-t border-muted py-3",
          showExpanded ? "px-3" : "px-[14px]",
        ].join(" ")}
      >
        <div className="hidden lg:contents">
          <SidebarItem
            icon={showExpanded ? PanelLeftClose : PanelLeftOpen}
            label={showExpanded ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => setExpanded((v) => !v)}
            expanded={showExpanded}
          />
        </div>
        <SidebarItem
          icon={isDark ? SunMedium : Moon}
          label={isDark ? "Switch to light" : "Switch to dark"}
          onClick={toggleTheme}
          expanded={showExpanded}
        />
        <SidebarItem
          icon={Settings}
          label="Settings"
          href={APP.settingsHref}
          expanded={showExpanded}
          onNavigate={onClose}
        />
      </div>
    </aside>
  );
}

function GroupLeaves({
  group,
  items,
  activeHref,
  onNavigate,
}: {
  group: NavGroup;
  items: NavItem[];
  activeHref?: string;
  onNavigate?: () => void;
}) {
  const lastHref = group.sections?.length
    ? group.sections.at(-1)?.items.at(-1)?.href
    : items.at(-1)?.href;

  if (!group.sections?.length) {
    return (
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.href}>
            <SidebarTreeItem
              href={item.href}
              label={item.label}
              icon={item.icon}
              badge={item.badge}
              active={activeHref === item.href}
              last={item.href === lastHref}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col">
      {group.sections.map((section, index) => (
        <div key={section.id}>
          <SidebarTreeLabel className={index === 0 ? "pt-1" : undefined}>
            {section.label}
          </SidebarTreeLabel>
          <ul className="flex flex-col">
            {section.items.map((item) => (
              <li key={item.href}>
                <SidebarTreeItem
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  badge={item.badge}
                  active={activeHref === item.href}
                  last={item.href === lastHref}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Hover panel for the collapsed rail so nested pages stay one click away
 * without opening the full tree.
 */
function CollapsedFlyout({
  group,
  items,
  activeHref,
  onNavigate,
}: {
  group: NavGroup;
  items: NavItem[];
  activeHref?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="pointer-events-none invisible absolute top-0 left-full z-50 opacity-0 transition-[opacity,visibility] duration-[180ms] group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 focus-within:pointer-events-auto focus-within:visible focus-within:opacity-100">
      <div className="pl-2">
        <div className="max-h-[min(80vh,560px)] w-[228px] overflow-y-auto rounded-xl border border-muted bg-container py-2 shadow-lg">
          <p className="px-3 pb-1 text-caption tracking-[0.08em] text-quaternary uppercase">
            {group.label}
          </p>
          <SidebarTreeBranch>
            <GroupLeaves
              group={group}
              items={items}
              activeHref={activeHref}
              onNavigate={onNavigate}
            />
          </SidebarTreeBranch>
        </div>
      </div>
    </div>
  );
}

/** Mobile-only control lives in the top bar, not the rail. */
export function SidebarMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open navigation"
      className="flex size-8 items-center justify-center rounded-full bg-action icon-tertiary outline-none transition-colors duration-[180ms] hover:bg-raised-2 hover:icon-secondary focus-visible:ring-2 focus-visible:ring-active lg:hidden"
    >
      <Menu size={16} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
