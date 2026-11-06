import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/api/services/AuthService";
import UserProfileModal from "@/components/user/UserProfileModal";
import { STAFF, MANAGER_UP, ADMIN_ONLY, SELF_MEAL_ROLES, hasAnyRole, canUsePersonalMeals, PERSONAL_MEAL_PATHS } from "@/constants/roles";

// Assume these icons are imported from an icon library
import { useSidebar } from "../context/SidebarContext";
import { mdiAccount, mdiAccountBoxOutline, mdiChartBoxMultipleOutline, mdiChevronDown, mdiCogOutline, mdiDotsHorizontal, mdiPower, mdiRice, mdiViewDashboard } from '@mdi/js';
import MdiIcon from "@/components/common/MdiIcon";

type NavSubItem = {
  name: string;
  path: string;
  pro?: boolean;
  new?: boolean;
  // Không truyền -> ai vào được menu cha thì vào được mục con này
  allowedRoles?: string[];
};

type NavItem = {
  name: string;
  icon: string;
  path?: string;
  // Không truyền -> mọi role đã đăng nhập đều thấy (vd Trang chủ, Đăng xuất...)
  allowedRoles?: string[];
  subItems?: NavSubItem[];
};

// Khớp CHÍNH XÁC với allowedRoles của từng route trong App.tsx - nếu không,
// sidebar sẽ hiển thị link mà user bấm vào bị ProtectedRoute đá thẳng về
// trang chủ (đây là nguyên nhân của lỗi "báo cáo/thống kê bị điều hướng về
// trang chủ").
const navItems: NavItem[] = [
  {
    icon: mdiViewDashboard,
    name: "Trang chủ",
    path: "/",
  },
  {
    icon: mdiRice,
    name: "Quản lý suất ăn",
    allowedRoles: STAFF,
    subItems: [
      {
        // Không gồm admin - admin là tài khoản quản lý, không tự đăng
        // ký/cắt suất ăn cho chính mình (khớp allowedRoles của route
        // "/meal-registration" trong App.tsx).
        name: "Đăng ký / Cắt suất ăn",
        path: "/meal-registration",
        allowedRoles: SELF_MEAL_ROLES,
      },
      {
        name: "Lịch ăn",
        path: "/meal-schedule",
        allowedRoles: STAFF,
      },
      {
        // Số liệu CÁ NHÂN của chính người đăng nhập (không gồm admin).
        name: "Thống kê suất ăn",
        path: "/my-statistics",
        allowedRoles: SELF_MEAL_ROLES,
      },
      {
        name: "Thanh toán",
        path: "/my-payments",
        allowedRoles: SELF_MEAL_ROLES,
      },
    ]
  },
  {
    icon: mdiCogOutline,
    name: "Quản lý hệ thống",
    allowedRoles: MANAGER_UP,
    subItems: [
      {
        name: "Quản lý người dùng",
        path: "/user-management",
        allowedRoles: MANAGER_UP,
      },
      {
        name: "Quản lý cấu hình",
        path: "/setting-management",
        allowedRoles: ADMIN_ONLY,
      },
      {
        name: "Quản lý quyền hệ thống",
        path: "/permission-management",
        allowedRoles: ADMIN_ONLY,
      },
      {
        name: "Quản lý thông báo",
        path: "/notification-management",
        allowedRoles: MANAGER_UP,
      },
      {
        name: "Theo dõi cắt suất ăn",
        path: "/meal-option-management",
        allowedRoles: MANAGER_UP,
      },
      {
        name: "Hủy lịch (nghỉ lễ/sự kiện)",
        path: "/holiday-event-management",
        allowedRoles: MANAGER_UP,
      },
      {
        name: "Lịch sử hệ thống",
        path: "/audit-log",
        allowedRoles: ADMIN_ONLY,
      },
    ]
  },
  {
    icon: mdiChartBoxMultipleOutline,
    // Báo cáo/thống kê toàn cơ quan (có xuất Excel) - chỉ admin + manager.
    name: "Báo cáo / Thống kê",
    path: "/reports",
    allowedRoles: MANAGER_UP,
  },
];

const userItems: NavItem[] = [
  {
    icon: mdiAccount,
    name: "Hồ sơ người dùng",
    path: "/profile",
  },
  {
    icon: mdiAccountBoxOutline,
    name: "Liên hệ",
    path: "/404",
  },
  {
    icon: mdiPower,
    name: "Đăng xuất",
    path: "/logout",
  },
];

// Lọc menu (và các mục con) theo role hiện tại của user - mục cha có
// subItems mà sau khi lọc không còn mục con nào thì cũng bị ẩn luôn, tránh
// hiển thị 1 nhóm menu rỗng.
const filterNavItemsByRole = (
  items: NavItem[],
  roleCodes: string[],
  personalMeals: boolean,
): NavItem[] =>
  items.reduce<NavItem[]>((visible, item) => {
    if (!hasAnyRole(roleCodes, item.allowedRoles)) return visible;

    if (item.subItems) {
      const visibleSubItems = item.subItems.filter((subItem) =>
        hasAnyRole(roleCodes, subItem.allowedRoles)
        && (personalMeals || !PERSONAL_MEAL_PATHS.includes(subItem.path)),
      );
      if (visibleSubItems.length === 0) return visible;
      visible.push({ ...item, subItems: visibleSubItems });
      return visible;
    }

    visible.push(item.path === "/" && roleCodes.includes("manager") && !personalMeals
      ? { ...item, name: "Điều hành bếp" } : item);
    return visible;
  }, []);

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const roleCodes = useMemo(
    () => user?.roles.map((r) => r.code) ?? [],
    [user],
  );
  const visibleNavItems = useMemo(
    () => filterNavItemsByRole(navItems, roleCodes, canUsePersonalMeals(user?.username, roleCodes)),
    [roleCodes, user?.username],
  );
  const visibleUserItems = useMemo(
    () => filterNavItemsByRole(userItems, roleCodes, canUsePersonalMeals(user?.username, roleCodes)),
    [roleCodes, user?.username],
  );

  const handleLogout = async () => {
    const confirmed = window.confirm("Bạn có chắc chắn muốn đăng xuất không?");
    if (!confirmed) {
      return;
    }
    try {
      await authService.logout(); // Báo backend hủy/vô hiệu hóa token
    } catch (error) {
      console.error("Lỗi khi gọi API đăng xuất:", error);
    } finally {
      logout(); // Xóa user/token khỏi localStorage + state
      navigate("/login", { replace: true });
    }
  };

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "user";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [showLabels, setShowLabels] = useState<boolean>(
    isExpanded || isMobileOpen
  );

  useEffect(() => {
    if (isExpanded || isMobileOpen) {
      const t = setTimeout(() => setShowLabels(true), 160);
      return () => clearTimeout(t);
    }

    if (isHovered) {
      const t = setTimeout(() => setShowLabels(true), 160);
      return () => clearTimeout(t);
    }

    setShowLabels(false);
  }, [isExpanded, isMobileOpen, isHovered]);

  // const isActive = (path: string) => location.pathname === path;
  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  useEffect(() => {
    let submenuMatched = false;
    ["main", "user"].forEach((menuType) => {
      const items = menuType === "main" ? visibleNavItems : visibleUserItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "user",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, isActive, visibleNavItems, visibleUserItems]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "user") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: NavItem[], menuType: "main" | "user") => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${openSubmenu?.type === menuType && openSubmenu?.index === index
                ? "menu-item-active"
                : "menu-item-inactive"
                } cursor-pointer ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
                }`}
            >
              <span
                className={`menu-item-icon-size  ${openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive"
                  }`}
              >
                <MdiIcon path={nav.icon} size={1} />
              </span>
              {showLabels && (
                <span className="menu-item-text">{nav.name}</span>
              )}
              {showLabels && (
                <MdiIcon
                  path={mdiChevronDown}
                  size={1}
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                    ? "rotate-180 text-brand-500"
                    : ""
                    }`}
                />
              )}
            </button>
          ) : nav.path === "/profile" ? (
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="menu-item group menu-item-inactive w-full text-left cursor-pointer"
            >
              <span className="menu-item-icon-size menu-item-icon-inactive">
                <MdiIcon path={nav.icon} size={1} />
              </span>
              {showLabels && (
                <span className="menu-item-text transition-transform duration-500">{nav.name}</span>
              )}
            </button>
          ) : nav.path === "/logout" ? (
            <button
              type="button"
              onClick={handleLogout}
              className="menu-item group menu-item-inactive w-full text-left cursor-pointer"
            >
              <span className="menu-item-icon-size menu-item-icon-inactive">
                <MdiIcon path={nav.icon} size={1} />
              </span>
              {showLabels && (
                <span className="menu-item-text transition-transform duration-500">{nav.name}</span>
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                  }`}
              >
                <span
                  className={`menu-item-icon-size ${isActive(nav.path)
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                    }`}
                >
                  <MdiIcon path={nav.icon} size={1} />
                </span>
                {showLabels && (
                  <span className="menu-item-text transition-transform duration-500">{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && showLabels && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      to={subItem.path}
                      className={`menu-dropdown-item ${isActive(subItem.path)
                        ? "menu-dropdown-item-active"
                        : "menu-dropdown-item-inactive"
                        }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge`}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge`}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-300 
        ${isExpanded || isMobileOpen
          ? "w-72.5"
          : isHovered
            ? "w-72.5"
            : "w-22.5"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex justify-center`}
      >
        <Link to="/">
          {showLabels ? (
            <>
              <img
                className="dark:hidden h-7.5 w-auto"
                src="./images/logo/logo-light.png"
                alt="Logo"
              />
              <img
                className="hidden dark:block h-7.5 w-auto"
                src="./images/logo/logo-dark.png"
                alt="Logo"
              />
            </>
          ) : (
            <img
              src="/images/logo/logo-icon.png"
              alt="Logo"
              className="h-7.5 w-auto"
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar h-full">
        <nav className="mb-6 h-full">
          <div className="flex h-full flex-1 flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-5 text-gray-400 ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start"
                  }`}
              >
                {showLabels ? (
                  "Menu"
                ) : (
                  <MdiIcon
                    path={mdiDotsHorizontal}
                    size={1}
                    className="size-6"
                  />
                )}
              </h2>
              {renderMenuItems(visibleNavItems, "main")}
            </div>
            <div className="mt-auto">
              <h2
                className={`mb-4 text-xs uppercase flex leading-5 text-gray-400 ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start"
                  }`}
              >
                {showLabels ? (
                  "Người dùng"
                ) : (
                  <MdiIcon
                    path={mdiDotsHorizontal}
                    size={1}
                    className="size-1"
                  />
                )}
              </h2>
              {renderMenuItems(visibleUserItems, "user")}
            </div>
          </div>
        </nav>
      </div>
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </aside>
  );
};

export default AppSidebar;
