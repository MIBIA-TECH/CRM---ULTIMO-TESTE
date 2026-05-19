import React, { useState, useEffect, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";
import Grid from "@material-ui/core/Grid";
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import moment from "moment";
import { SaveAlt, Refresh, CloudDownload, FolderOpen, DeleteOutline } from "@material-ui/icons";
import ConfirmationModal from "../../components/ConfirmationModal";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    background: theme.palette.fancyBackground,
  },
  mainPaper: {
    flex: 1,
    marginTop: 20,
    borderRadius: 20,
    border: "0px !important",
    marginBottom: 40,
    overflow: "hidden",
  },
  mainPaperTable: {
    flex: 1,
    overflow: "auto",
    height: "65vh",
    ...theme.scrollbarStylesSoftBig,
  },
  chipWhatsApp: {
    backgroundColor: "#25d366",
    color: "#fff",
    fontWeight: 600,
  },
  chipChat: {
    backgroundColor: "#128C7E",
    color: "#fff",
    fontWeight: 600,
  },
  emptyContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(8),
  },
  generateForm: {
    padding: theme.spacing(3),
  },
  infoText: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
}));

const Backup = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [tab, setTab] = useState(0);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dateFrom, setDateFrom] = useState(
    moment().subtract(7, "days").format("YYYY-MM-DD")
  );
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteFilename, setDeleteFilename] = useState(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/backups");
      setBackups(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleDownload = async (filename) => {
    try {
      const response = await api.get(`/backups/${filename}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toastError(err);
    }
  };

  const handleDeleteBackup = async (filename) => {
    try {
      await api.delete(`/backups/${filename}`);
      toast.success(i18n.t("backup.toasts.deleted"));
      fetchBackups();
    } catch (err) {
      toastError(err);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post("/backups/generate", { dateFrom, dateTo });
      toast.success("Backup gerado com sucesso!");
      setTab(0);
      fetchBackups();
    } catch (err) {
      toastError(err);
    } finally {
      setGenerating(false);
    }
  };

  const getTypeChip = (type) => {
    if (type === "whatsapp") {
      return (
        <Chip
          size="small"
          label="WhatsApp"
          className={classes.chipWhatsApp}
        />
      );
    }
    return (
      <Chip size="small" label="Chat Interno" className={classes.chipChat} />
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  return (
    <MainContainer className={classes.mainContainer}>
      <Title>{i18n.t("backup.title")}</Title>

      <MainHeader>
        <Paper variant="outlined" style={{ width: "100%", marginBottom: 12 }}>
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab label={i18n.t("backup.tabs.automatic")} />
            <Tab label={i18n.t("backup.tabs.generate")} />
          </Tabs>
        </Paper>
      </MainHeader>

      {tab === 0 && (
        <>
          <MainHeaderButtonsWrapper>
            <Button
              variant="contained"
              color="primary"
              onClick={fetchBackups}
              startIcon={<Refresh />}
              size="small"
            >
              {i18n.t("backup.buttons.refresh")}
            </Button>
          </MainHeaderButtonsWrapper>

          <Paper className={classes.mainPaperTable} variant="outlined">
            {loading ? (
              <div className={classes.emptyContainer}>
                <CircularProgress />
              </div>
            ) : backups.length === 0 ? (
              <div className={classes.emptyContainer}>
                <FolderOpen
                  style={{ fontSize: 64, color: "#ccc", marginBottom: 16 }}
                />
                <Typography variant="h6" style={{ color: "#999" }}>
                  {i18n.t("backup.empty")}
                </Typography>
                <Typography variant="body2" style={{ color: "#bbb" }}>
                  {i18n.t("backup.emptyHint")}
                </Typography>
              </div>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center">
                      {i18n.t("backup.table.type")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("backup.table.date")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("backup.table.filename")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("backup.table.size")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("backup.table.actions")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.filename}>
                      <TableCell align="center">
                        {getTypeChip(backup.type)}
                      </TableCell>
                      <TableCell align="center">
                        {formatDate(backup.date)}
                      </TableCell>
                      <TableCell align="center">{backup.filename}</TableCell>
                      <TableCell align="center">
                        {backup.sizeFormatted}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={i18n.t("backup.buttons.download")}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleDownload(backup.filename)}
                          >
                            <CloudDownload />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={i18n.t("backup.buttons.delete")}>
                          <IconButton
                            size="small"
                            color="secondary"
                            onClick={() => {
                              setDeleteFilename(backup.filename);
                              setDeleteModalOpen(true);
                            }}
                          >
                            <DeleteOutline />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </>
      )}

      {tab === 1 && (
        <Paper className={classes.mainPaper} variant="outlined">
          <div className={classes.generateForm}>
            <Typography variant="h6" gutterBottom>
              {i18n.t("backup.generate.title")}
            </Typography>
            <Typography className={classes.infoText}>
              {i18n.t("backup.generate.description")}
            </Typography>
            <Typography variant="body2" style={{ color: "#e65100", marginBottom: 12 }}>
              {i18n.t("backup.generate.limitWarning")}
            </Typography>

            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  label={i18n.t("backup.generate.dateFrom")}
                  type="date"
                  value={dateFrom}
                  variant="outlined"
                  fullWidth
                  size="small"
                  onChange={(e) => setDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  label={i18n.t("backup.generate.dateTo")}
                  type="date"
                  value={dateTo}
                  variant="outlined"
                  fullWidth
                  size="small"
                  onChange={(e) => setDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleGenerate}
                  disabled={generating}
                  startIcon={
                    generating ? (
                      <CircularProgress size={20} />
                    ) : (
                      <SaveAlt />
                    )
                  }
                  fullWidth
                >
                  {generating
                    ? i18n.t("backup.generate.generating")
                    : i18n.t("backup.generate.button")}
                </Button>
              </Grid>
            </Grid>
          </div>
        </Paper>
      )}

      <ConfirmationModal
        title={i18n.t("backup.deleteModal.title")}
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={() => handleDeleteBackup(deleteFilename)}
      >
        {i18n.t("backup.deleteModal.message")}
      </ConfirmationModal>
    </MainContainer>
  );
};

export default Backup;
