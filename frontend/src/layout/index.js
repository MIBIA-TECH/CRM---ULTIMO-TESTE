import React, { useState, useContext, useEffect, useMemo, useCallback } from "react";
import clsx from "clsx";
import {
  makeStyles,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  Button,
  MenuItem,
  IconButton,
  Menu,
  useTheme,
  useMediaQuery,
  Avatar,
  Badge,
  withStyles,
  Chip,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Checkbox,
  FormControlLabel,
} from "@material-ui/core";
// Ícones do Lucide React
import {
  Text,
  ChevronLeft,
  Bell,
  RefreshCcw,
  Globe
} from "lucide-react";
import api from "../services/api";
import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import NotificationsVolume from "../components/NotificationsVolume";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import AnnouncementsPopover from "../components/AnnouncementsPopover";
import logo from "../assets/logo.png";
import logoDark from "../assets/logo-black.png";
import ChatPopover from "../pages/Chat/ChatPopover";
import { useDate } from "../hooks/useDate";
import ColorModeContext from "./themeContext";
import { getBackendUrl } from "../config";
import useSettings from "../hooks/useSettings";
import useSocketListener from "../hooks/useSocketListener";

// Componente wrapper para ícones do Lucide React
const LucideIcon = ({ icon: Icon, size = 24, ...props }) => {
  return <Icon size={size} {...props} />;
};

const backendUrl = getBackendUrl();
const drawerWidth = 240;


const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100vh",
    [theme.breakpoints.down("sm")]: {
      height: "calc(100vh - 56px)",
    },
    backgroundColor: theme.palette.fancyBackground,
    "& .MuiButton-outlinedPrimary": {
      color: theme.palette.primary.main, // Usa cor do tema
      border: `1px solid ${theme.palette.primary.main}40`,
      borderRadius: "8px",
      fontWeight: 600,
      textTransform: "none",
      transition: "all 0.3s ease",
      "&:hover": {
        backgroundColor: `${theme.palette.primary.main}10`,
        borderColor: theme.palette.primary.main,
        transform: "translateY(-1px)",
        boxShadow: `0 4px 12px ${theme.palette.primary.main}30`,
      },
    },
    "& .MuiTab-textColorPrimary.Mui-selected": {
      color: theme.palette.primary.main, // Usa cor do tema
      fontWeight: 700,
    },
  },

  chip: {
    background: "red",
    color: "white",
  },

  avatar: {
    width: "100%",
  },

  toolbar: {
    paddingRight: 24,
    color: theme.palette.dark.main,
    background: "linear-gradient(to right, #182229, #182229, #182229)", // Mesma cor da sidebar
    minHeight: "58px",
  },

  toolbarIcon: {
    background: "linear-gradient(to right, #182229, #182229, #182229)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 8px",
    minHeight: "58px",
    [theme.breakpoints.down("sm")]: {
      height: "58px",
    },
    color: "white",
  },

  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },

  menuButtonHidden: {
    display: "none",
  },

  title: {
    flexGrow: 1,
    fontSize: 14,
    color: "white",
    fontWeight: 600,
    letterSpacing: "0.025em",
  },

  drawerPaper: {
    background: "linear-gradient(to right, #182229, #182229, #182229)",
    color: "white",
    position: "relative",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: {
      width: drawerWidth,
      position: "fixed",
      height: "100vh",
      zIndex: theme.zIndex.drawer,
    },
    boxShadow: "0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)",
  },

  drawerPaperClose: {
    overflow: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up("sm")]: {
      width: theme.spacing(9),
    },
    [theme.breakpoints.down("sm")]: {
      width: 0,
      display: "none",
    },
  },

  appBarSpacer: {
    minHeight: "58px",
  },

  content: {
    flex: 1,
    overflow: "auto",
    padding: 0,
    margin: 0,
  },

  container: {
    padding: 0,
    margin: 0,
    maxWidth: "none",
    width: "100%",
  },

  containerWithScroll: {
    flex: 1,
    overflowY: "scroll",
    overflowX: "hidden",
    ...theme.scrollbarStyles,
    borderRadius: "8px",
    border: "2px solid transparent",
    "&::-webkit-scrollbar": {
      display: "none",
    },
    "-ms-overflow-style": "none",
    "scrollbar-width": "none",
  },

  NotificationsPopOver: {
    // Mantém original
  },

  logo: {
    width: "100%",
    height: "45px",
    maxWidth: 180,
    [theme.breakpoints.down("sm")]: {
      width: "auto",
      height: "100%",
      maxWidth: 180,
    },
    logo: theme.logo,
    content:
      "url(" +
      (theme.mode === "light"
        ? theme.calculatedLogoLight()
        : theme.calculatedLogoDark()) +
      ")",
    transition: "all 0.3s ease", // Transição suave
    "&:hover": {
      transform: "scale(1.02)", // Pequeno zoom no hover
    },
  },

  hideLogo: {
    display: "none",
  },

  avatar2: {
    width: theme.spacing(4),
    height: theme.spacing(4),
    cursor: "pointer",
    borderRadius: "50%",
    border: "2px solid #ccc",
    transition: "all 0.3s ease",
    "&:hover": {
      transform: "scale(1.05)",
      borderColor: theme.palette.primary.main, // Usa cor do tema
    },
  },

  updateDiv: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  // Botões da toolbar melhorados
  toolbarButton: {
    color: "rgba(255, 255, 255, 0.9)",
    borderRadius: "8px",
    padding: "8px",
    margin: "0 2px",
    transition: "all 0.3s ease",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      transform: "translateY(-1px)",
    },
    "&:active": {
      transform: "translateY(0)",
    },
  },

  // Menu hambúrguer com animação sutil
  menuButton: {
    color: "white",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    "& .MuiSvgIcon-root": {
      transition: "transform 0.3s ease",
    },
    "&:hover .MuiSvgIcon-root": {
      transform: "rotate(90deg)",
    },
  },

  // Seletor de idioma melhorado
  languageSelector: {
    position: "relative",
    display: "inline-block",
    "& > button": {
      background: "rgba(255, 255, 255, 0.1)",
      border: "none",
      borderRadius: "8px",
      color: "rgba(255, 255, 255, 0.9)",
      fontSize: "18px",
      padding: "8px 12px",
      cursor: "pointer",
      transition: "all 0.3s ease",
      "&:hover": {
        background: "rgba(255, 255, 255, 0.2)",
        transform: "translateY(-1px)",
      },
    },
    "& > div": {
      position: "absolute",
      top: "45px",
      left: "0",
      background: "#fff",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      borderRadius: "8px",
      padding: "8px",
      zIndex: 1000,
      minWidth: "120px",
      "& button": {
        background: "none",
        border: "none",
        color: "#374151",
        display: "block",
        width: "100%",
        padding: "8px 12px",
        textAlign: "left",
        borderRadius: "6px",
        fontSize: "14px",
        fontWeight: 500,
        transition: "all 0.2s ease",
        "&:hover": {
          background: `${theme.palette.primary.main}10`, // Usa cor do tema
          color: theme.palette.primary.main, // Usa cor do tema
          transform: "none",
        },
      },
    },
  },

  // Badge animado
  animatedBadge: {
    "& .MuiBadge-badge": {
      animation: "$heartbeat 2s infinite",
    },
  },

  "@keyframes heartbeat": {
    "0%": { transform: "scale(1)" },
    "14%": { transform: "scale(1.1)" },
    "28%": { transform: "scale(1)" },
    "42%": { transform: "scale(1.1)" },
    "70%": { transform: "scale(1)" },
  },
}));

const StyledBadge = withStyles((theme) => ({
  badge: {
    backgroundColor: "#44b700",
    color: "#44b700",
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    "&::after": {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      animation: "$ripple 1.2s infinite ease-in-out",
      border: "1px solid currentColor",
      content: '""',
    },
  },
  "@keyframes ripple": {
    "0%": {
      transform: "scale(.8)",
      opacity: 1,
    },
    "100%": {
      transform: "scale(2.4)",
      opacity: 0,
    },
  },
}))(Badge);

const SmallAvatar = withStyles((theme) => ({
  root: {
    width: 22,
    height: 22,
    border: `2px solid ${theme.palette.background.paper}`,
  },
}))(Avatar);

const LoggedInLayout = ({ children, themeToggle }) => {
  const classes = useStyles();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading, user, socket, handleAcceptTerms } = useContext(AuthContext);
  const [acceptedTermsChecked, setAcceptedTermsChecked] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVariant, setDrawerVariant] = useState("permanent");

  const [showOptions, setShowOptions] = useState(false);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const theme = useTheme();
  const { colorMode } = useContext(ColorModeContext);
  const greaterThenSm = useMediaQuery(theme.breakpoints.up("sm"));

  const [volume, setVolume] = useState(
    localStorage.getItem("volume") !== null ? localStorage.getItem("volume") : 1
  );

  const { dateToClient } = useDate();
  const [profileUrl, setProfileUrl] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mainListItems = useMemo(
    () => <MainListItems drawerOpen={drawerOpen} collapsed={!drawerOpen} />,
    [drawerOpen]
    [user, drawerOpen]
  );

  const settings = useSettings();

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data } = await api.get("/announcements/for-company", {
          params: {
            status: true,
            pageNumber: "1"
          }
        });
  
        // Filtra apenas os informativos ativos e não expirados
        const activeAnnouncements = data.records.filter(announcement => {
          const isActive = announcement.status === true || announcement.status === "true";
          const isNotExpired = !announcement.expiresAt || new Date(announcement.expiresAt) > new Date();
          return isActive && isNotExpired;
        });
  
        setAnnouncements(activeAnnouncements);
        
        // Mostra o modal apenas se houver informativos ativos
        if (activeAnnouncements.length > 0) {
          setShowAnnouncementsModal(true);
        }
      } catch (err) {
        toastError(err);
      }
    };
  
    if (user?.id) {
      fetchAnnouncements();
    }
  }, [user?.id]);

  useEffect(() => {
    // if (localStorage.getItem("public-token") === null) {
    //   handleLogout()
    // }

    if (document.body.offsetWidth > 600) {
      if (user.defaultMenu === "closed") {
        setDrawerOpen(false);
      } else {
        setDrawerOpen(true);
      }
    }
    if (user.defaultTheme === "dark" && theme.mode === "light") {
      colorMode.toggleColorMode();
    }
    if (user.defaultTheme === "light" && theme.mode === "dark") {
      colorMode.toggleColorMode();
    }
  }, [user.defaultMenu, user.defaultTheme, theme.mode, document.body.offsetWidth]);

  useEffect(() => {
    if (document.body.offsetWidth < 600) {
      setDrawerVariant("temporary");
    } else {
      setDrawerVariant("permanent");
    }
  }, [drawerOpen]);

  useEffect(() => {
  const companyId = user?.companyId;
  
  if (companyId) {
    const buildProfileUrl = () => {
      const savedProfileImage = localStorage.getItem("profileImage");
      const currentProfileImage = savedProfileImage || user.profileImage;
      
      if (currentProfileImage) {
        return `${backendUrl}/public/company${companyId}/user/${currentProfileImage}`;
      }
      return `${backendUrl}/public/app/noimage.png`;
    };

    setProfileUrl(buildProfileUrl());
  }
}, [user?.companyId, user?.profileImage, backendUrl]);

// Callbacks dos eventos
const handleAuthEvent = useCallback((data) => {
  if (data.user.id === +user?.id) {
    toastError("Sua conta foi acessada em outro computador.");
    setTimeout(() => {
      localStorage.clear();
      window.location.reload();
    }, 1000);
  }
}, [user?.id]);

const handleUserUpdate = useCallback((data) => {
  if (data.action === "update" && data.user.id === +user?.id) {
    if (data.user.profileImage) {
      const newProfileUrl = `${backendUrl}/public/company${user?.companyId}/user/${data.user.profileImage}`;
      setProfileUrl(newProfileUrl);
      localStorage.setItem("profileImage", data.user.profileImage);
    }
  }
}, [user?.companyId, user?.id, backendUrl]);

// Registrar listeners
useSocketListener(socket, user, 'auth', handleAuthEvent);
useSocketListener(socket, user, 'user', handleUserUpdate);

// Status do usuário
useEffect(() => {
  if (socket?.emit && user?.companyId) {
    socket.emit("userStatus");
    
    const interval = setInterval(() => {
      socket?.emit && socket.emit("userStatus");
    }, 1000 * 60 * 5);

    return () => clearInterval(interval);
  }
}, [socket, user?.companyId]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };

  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };

  const drawerClose = () => {
    if (document.body.offsetWidth < 600 || user.defaultMenu === "closed") {
      setDrawerOpen(false);
    }
  };

  const handleRefreshPage = () => {
    window.location.reload(false);
  };

  const handleMenuItemClick = () => {
    const { innerWidth: width } = window;
    if (width <= 600) {
      setDrawerOpen(false);
    }
  };

  const handleLanguageChange = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);
    window.location.reload();
  };

  const LANGUAGE_OPTIONS = [
    { code: "pt-BR", label: "Português" },
    { code: "en", label: "English" },
    { code: "es", label: "Spanish" },
    { code: "ar", label: "عربي" },
  ];

  const [enabledLanguages, setEnabledLanguages] = useState(["pt-BR", "en"]);
  const { getAll } = useSettings();
  useEffect(() => {
    async function fetchSettings() {
      try {
        const settings = await getAll();
        const enabledLanguagesSetting = settings.find(
          (s) => s.key === "enabledLanguages"
        )?.value;
        let langs = ["pt-BR", "en"];
        try {
          if (enabledLanguagesSetting) {
            langs = JSON.parse(enabledLanguagesSetting);
          }
        } catch { }
        console.log(
          "Layout - enabledLanguages carregadas:",
          langs,
          "para companyId:",
          user?.companyId
        );
        setEnabledLanguages(langs);
      } catch (error) {
        console.log("Layout - erro ao carregar enabledLanguages:", error);
      }
    }
    fetchSettings();
  }, [user?.companyId]);

  const filteredLanguageOptions = LANGUAGE_OPTIONS.filter((lang) =>
    enabledLanguages.includes(lang.code)
  );

    if (loading) {
    return <BackdropLoading />;
  }

  return (
    <div className={clsx(classes.root, "logged-in-layout")}>
      <Drawer
        variant={drawerVariant}
        className={drawerOpen ? classes.drawerPaper : classes.drawerPaperClose}
        classes={{
          paper: clsx(
            classes.drawerPaper,
            !drawerOpen && classes.drawerPaperClose
          ),
        }}
        open={drawerOpen}
      >
        <div className={classes.toolbarIcon}>
          <img
            src={colorMode.appLogoLight || logo}
            className={drawerOpen ? classes.logo : classes.hideLogo}
            style={{ 
              display: "block",
              margin: "0 auto",
              width: "100%",
            }}
            alt="logo"
          />
          <IconButton onClick={() => setDrawerOpen(!drawerOpen)}>
            <LucideIcon icon={ChevronLeft} size={22} style={{ color: "white" }} />
          </IconButton>
        </div>
        <List className={classes.containerWithScroll}>
          {/* {mainListItems} */}
          <MainListItems collapsed={!drawerOpen} />
        </List>
        <Divider />
      </Drawer>

      <AppBar
        position="absolute"
        className={clsx(classes.appBar, drawerOpen && classes.appBarShift)}
        color="primary"
      >
        <Toolbar variant="dense" className={classes.toolbar}>
          <IconButton
            edge="start"
            variant="contained"
            aria-label="open drawer"
            style={{ color: "white" }}
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={clsx(drawerOpen && classes.menuButtonHidden)}
          >
            <LucideIcon icon={Text} />
          </IconButton>

          <Typography
            component="h2"
            variant="h6"
            color="inherit"
            noWrap
            className={classes.title}
          >
            {/* {greaterThenSm && user?.profile === "admin" && getDateAndDifDays(user?.company?.dueDate).difData < 7 ? ( */}
            {greaterThenSm &&
              user?.profile === "admin" &&
              user?.company?.dueDate ? (
              <>
                {i18n.t("mainDrawer.appBar.user.message")} <b>{user.name}</b>,{" "}
                {i18n.t("mainDrawer.appBar.user.messageEnd")}{" "}
                <b>{user?.company?.name}</b>! (
                {i18n.t("mainDrawer.appBar.user.active")}{" "}
                {dateToClient(user?.company?.dueDate)})
              </>
            ) : (
              <>
                {i18n.t("mainDrawer.appBar.user.message")} <b>{user.name}</b>,{" "}
                {i18n.t("mainDrawer.appBar.user.messageEnd")}{" "}
                <b>{user?.company?.name}</b>!
              </>
            )}
          </Typography>


          <div
            style={{ position: "relative", display: "inline-block" }}
            className="language-dropdown"
          >
            <button
              onClick={() => setShowOptions(!showOptions)}
              style={{
                background: "none",
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: "22px",
                paddingRight: "20px",
                paddingTop: "8px",
              }}
            >
              <LucideIcon icon={Globe} />
            </button>

            {showOptions && (
              <div
                style={{
                  position: "absolute",
                  top: "35px",
                  left: "0",
                  background: "#fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  borderRadius: "8px",
                  padding: "8px",
                  zIndex: 1000,
                  minWidth: "120px",
                  maxWidth: "200px",
                }}
              >
                {filteredLanguageOptions.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      display: "block",
                      width: "100%",
                      padding: "4px",
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <NotificationsVolume setVolume={setVolume} volume={volume} />

          <IconButton
            onClick={handleRefreshPage}
            aria-label={i18n.t("mainDrawer.appBar.refresh")}
            color="inherit"
          >
            <LucideIcon icon={RefreshCcw} style={{ color: "white" }} />
          </IconButton>

          {/* <DarkMode themeToggle={themeToggle} /> */}

          {user.id && <NotificationsPopOver volume={volume} />}

          <AnnouncementsPopover />

          <ChatPopover />

          <div className="user-menu-wrapper">
            <StyledBadge
              overlap="circular"
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              variant="dot"
              onClick={handleMenu}
            >
              <Avatar
                alt="Multi100"
                className={classes.avatar2}
                src={profileUrl}
              />
            </StyledBadge>

            <UserModal
              open={userModalOpen}
              onClose={() => setUserModalOpen(false)}
              onImageUpdate={(newProfileUrl) => setProfileUrl(newProfileUrl)}
              userId={user?.id}
            />

            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              getContentAnchorEl={null}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={menuOpen}
              onClose={handleCloseMenu}
              PaperProps={{
                style: {
                  minWidth: "150px",
                  maxWidth: "200px",
                  width: "auto",
                },
              }}
            >
              <MenuItem onClick={handleOpenUserModal}>
                {i18n.t("mainDrawer.appBar.user.profile")}
              </MenuItem>
              <MenuItem onClick={handleClickLogout}>
                {i18n.t("mainDrawer.appBar.user.logout")}
              </MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
      <main className={classes.content}>
        <div className={classes.appBarSpacer} />
        {children ? children : null}
      </main>

      {/* Modal de Informativos */}
      <Dialog
        open={showAnnouncementsModal}
        onClose={() => setShowAnnouncementsModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Informativos</DialogTitle>
        <DialogContent dividers>
          {selectedAnnouncement ? (
            <div>
              <Typography variant="h6" gutterBottom>
                {selectedAnnouncement.title}
              </Typography>
              <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>
                {selectedAnnouncement.text}
              </Typography>
              {selectedAnnouncement.mediaPath && (
                <div style={{ marginTop: 16 }}>
                  <img
                    src={`${backendUrl}/public/company${user.companyId}${selectedAnnouncement.mediaPath}`}
                    alt="Anexo"
                    style={{ maxWidth: '100%' }}
                  />
                </div>
              )}
              <Button
                onClick={() => setSelectedAnnouncement(null)}
                style={{ marginTop: 16 }}
                variant="outlined"
              >
                Voltar para lista
              </Button>
            </div>
          ) : (
            <List>
              {announcements.map((announcement) => (
                <ListItem
                  button
                  key={announcement.id}
                  onClick={() => setSelectedAnnouncement(announcement)}
                >
                  <ListItemAvatar>
                    <Avatar>
                      <LucideIcon icon={Bell} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={announcement.title}
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="body2"
                          color="textPrimary"
                        >
                          Prioridade: {announcement.priority === 1 ? 'Alta' : announcement.priority === 2 ? 'Média' : 'Baixa'}
                        </Typography>
                        {` — ${new Date(announcement.createdAt).toLocaleDateString()}`}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowAnnouncementsModal(false)}
            color="primary"
          >
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Termos de Uso */}
      <Dialog
        open={!!user && user.acceptedTerms === false}
        disableBackdropClick
        disableEscapeKeyDown
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle style={{ textAlign: "center", fontWeight: "bold" }}>
          Termos e Condições de Uso - Mibia CRM
        </DialogTitle>
        <DialogContent dividers>
          <div style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "10px" }}>
            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              1. Introdução
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              Bem-vindo ao nosso sistema de CRM. Estes Termos e Condições regem o uso do sistema e definem as responsabilidades do usuário e da nossa empresa. Ao utilizar o sistema, você concorda integralmente com estes Termos. Caso não concorde, não utilize o sistema.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              2. Definições
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              <strong>Mibia CRM:</strong> A plataforma disponibilizada para gestão de contatos, vendas, tickets e outras funcionalidades de relacionamento com clientes.<br />
              <strong>Usuário:</strong> Pessoa física ou jurídica que utiliza o sistema.<br />
              <strong>Empresa:</strong> Mibia Digital LTDA (CNPJ 37.617.938/0001-65) - A detentora dos direitos e operadora do sistema.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              3. Licença de Uso
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              O usuário recebe uma licença não exclusiva, intransferível e limitada para utilizar o sistema conforme previsto nestes Termos. O uso do sistema é permitido somente para fins legais e dentro do escopo contratado.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              4. Responsabilidades do Usuário
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              4.1. O usuário é responsável pela veracidade e pela atualização das informações inseridas no sistema.<br />
              4.2. O usuário deve manter a confidencialidade de suas credenciais de acesso e notificar imediatamente a empresa em caso de acesso não autorizado.<br />
              4.3. O uso do sistema para atividades ilícitas ou para qualquer finalidade que viole legislações vigentes é estritamente proibido.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              5. Disponibilidade e Suporte
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              5.1. A empresa se esforçará para garantir que o sistema esteja disponível 24 horas por dia, 7 dias por semana, salvo interrupções necessárias para manutenção, atualizações ou fatores além do controle da empresa.<br />
              5.2. O suporte será fornecido nos canais indicados pela empresa, durante o horário comercial, salvo disposição em contrato.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              6. Propriedade Intelectual
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              Todos os direitos de propriedade intelectual relativos ao sistema, incluindo códigos-fonte, designs e marcas, são de titularidade exclusiva da empresa. O usuário não está autorizado a reproduzir, modificar, distribuir ou criar derivações do sistema.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              7. Planos, Pagamentos e Suspensão
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              7.1. O uso do sistema está sujeito ao pagamento do plano contratado, conforme valores, conditions e periodicidade previamente acordados.<br />
              7.2. Caso o pagamento não seja realizado até 7 (sete) dias após a data de vencimento, o acesso ao sistema será automaticamente bloqueado até que o pagamento seja regularizado.<br />
              7.3. A regularização financeira restabelecerá o acesso ao sistema em até 24 (vinte e quatro) horas após a confirmação do pagamento.<br />
              7.4. Não será concedida compensação ou reembolso por eventuais interrupções de serviço devido ao não pagamento.<br />
              7.5. Os valores referentes ao plano contratado contemplam exclusivamente a utilização do Mibia CRM. Custos decorrentes de serviços de terceiros, incluindo, mas não se limitando à API Oficial do WhatsApp, provedores de mensagens, hospedagem complementar, integrações ou serviços adicionais, serão cobrados separadamente e serão de responsabilidade exclusiva do usuário.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              8. Integração com WhatsApp API Oficial (Meta)
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              8.1. O Mibia CRM poderá ser integrado à API Oficial do WhatsApp Business, fornecida e gerenciada pela Meta Platforms, Inc. ("Meta"), por meio de parceiros autorizados.<br />
              8.2. O usuário declara estar ciente de que a utilização da API Oficial do WhatsApp está sujeita aos Termos de Uso, Políticas Comerciais, Políticas de Mensagens e demais regras estabelecidas pela Meta, podendo estas ser alteradas a qualquer momento sem interferência da Empresa.<br />
              8.3. A Empresa não possui qualquer controle sobre decisões, restrições, suspensões, bloqueios, limitações, banimentos ou cancelamentos de números telefônicos, contas comerciais ou serviços promovidos pela Meta, não podendo ser responsabilizada por perdas, indisponibilidades, interrupções, bloqueios temporários ou definitivos, perda de número, perda de acesso à conta ou quaisquer prejuízos decorrentes de ações realizadas pela Meta.<br />
              8.4. O usuário é integralmente responsável pelo conteúdo das mensagens enviadas, pela observância das políticas da Meta e pela obtenção dos consentimentos necessários para comunicação com seus contatos, isentando a Empresa de qualquer responsabilidade decorrente do uso inadequado da plataforma ou da API Oficial do WhatsApp.<br />
              8.5. Todos os custos, tarifas, cobranças por mensagens, conversas, templates, autenticações, utilidades, marketing, taxas de provedores oficiais (BSPs) e quaisquer outros valores relacionados à utilização da API Oficial do WhatsApp serão de exclusiva responsabilidade do usuário, não estando incluídos nos valores dos planos do Mibia CRM, salvo quando expressamente previsto em contrato.<br />
              8.6. A Empresa não se responsabiliza por reajustes, alterações de preços, mudanças operacionais, limitações técnicas ou descontinuidade dos serviços promovidos pela Meta ou pelos provedores oficiais da API do WhatsApp.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              9. Limitação de Responsabilidade
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              A empresa não se responsabiliza por danos diretos, indiretos, incidentais ou consequentes decorrentes do uso ou da impossibilidade de uso do sistema, exceto nos casos em que houver dolo ou culpa grave comprovados.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              10. Privacidade e Proteção de Dados
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              O uso dos dados do usuário estará em conformidade com a legislação aplicável de proteção de dados. Para mais detalhes, consulte nossa Política de Privacidade.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              11. Rescisão
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              A empresa se reserva o direito de rescindir o acesso do usuário ao sistema em caso de violação destes Termos, sem prejuízo de cobranças de valores devidos.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              12. Alterações nos Termos
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              Estes Termos podem ser atualizados pela empresa a qualquer momento. As alterações serão comunicadas aos usuários e entrarão em vigor na data indicada na notificação.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              13. Disposições Gerais
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              12.1. Caso alguma disposição destes Termos seja considerada inválida ou inexequível, as demais disposições permanecerão em pleno vigor e efeito.<br />
              12.2. Estes Termos serão regidos pelas leis brasileiras. Qualquer controvérsia será dirimida no foro da comarca da sede da empresa.
            </Typography>

            <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#182229", fontSize: "15px" }}>
              14. Contato
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: "4px", marginBottom: "16px", lineHeight: "1.6" }}>
              Dúvidas ou solicitações relacionadas a estes Termos devem ser enviadas para o e-mail suporte@mibiadigital.com.br
            </Typography>
          </div>
          <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-start" }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={acceptedTermsChecked}
                  onChange={(e) => setAcceptedTermsChecked(e.target.checked)}
                  color="primary"
                />
              }
              label="Li e aceito os Termos e Condições de Uso acima"
            />
          </div>
        </DialogContent>
        <DialogActions style={{ padding: "16px 24px" }}>
          <Button
            onClick={handleLogout}
            color="secondary"
            variant="outlined"
            style={{ marginRight: "auto" }}
          >
            Recusar e Sair
          </Button>
          <Button
            onClick={handleAcceptTerms}
            color="primary"
            variant="contained"
            disabled={!acceptedTermsChecked}
          >
            Aceitar e Continuar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default LoggedInLayout;