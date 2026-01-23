import 'dart:io';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:screenshot/screenshot.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:intl/intl.dart';
import 'package:sph_control_accesos/constants.dart';
import 'package:sph_control_accesos/models/db.dart';

class LogItem {
  final String idQR;
  final String claveAcceso;
  final String visitorName;
  final String fechaValidez;
  final String tipoQR;
  final String fc;

  LogItem({
    required this.idQR,
    required this.claveAcceso,
    required this.visitorName,
    required this.fechaValidez,
    required this.tipoQR,
    required this.fc,
  });
}

class DashboardPage extends StatefulWidget {
  final CatUser? currentUser;

  const DashboardPage({super.key, this.currentUser});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  int _limit = 0;
  int _usage = 0;
  List<LogItem> _logs = [];
  bool _loading = false;

  // Share state
  bool _isSharing = false;

  @override
  void initState() {
    super.initState();
    if (widget.currentUser != null) {
      _fetchData();
    }
  }

  @override
  void didUpdateWidget(DashboardPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentUser != widget.currentUser &&
        widget.currentUser != null) {
      _fetchData();
    }
  }

  Future<void> _fetchData() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
    });

    await Future.wait([_fetchStats(), _fetchLogs()]);

    if (mounted) {
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _fetchStats() async {
    if (widget.currentUser?.idEmpresa == null) return;

    try {
      // 1. Limit
      final empresaResponse =
          await Supabase.instance.client
              .from('empresas')
              .select('qrDiarios')
              .eq('idEmpresa', widget.currentUser!.idEmpresa!)
              .maybeSingle();

      final limit = (empresaResponse?['qrDiarios'] as int?) ?? 0;

      // 2. Usage
      final packsResponse = await Supabase.instance.client
          .from('qrEmpresas')
          .select('idQrEmpresas')
          .eq('idEmpresa', widget.currentUser!.idEmpresa!);

      final packs = packsResponse as List<dynamic>;
      int usage = 0;

      if (packs.isNotEmpty) {
        final packIds = packs.map((p) => p['idQrEmpresas']).toList();
        final today = DateTime.now().toIso8601String().split('T')[0];

        // Chunking
        const chunkSize = 10;
        for (var i = 0; i < packIds.length; i += chunkSize) {
          final end =
              (i + chunkSize < packIds.length) ? i + chunkSize : packIds.length;
          final chunk = packIds.sublist(i, end);

          final countResponse = await Supabase.instance.client
              .from('qrGenerados')
              .count(CountOption.exact)
              .inFilter('idQrEmpresas', chunk)
              .eq('tipoQR', 'Uso General')
              .gte('fc', '${today}T00:00:00')
              .lte('fc', '${today}T23:59:59');

          usage += countResponse;
        }
      }

      if (mounted) {
        setState(() {
          _limit = limit;
          _usage = usage;
        });
      }
    } catch (e) {
      debugPrint('Error fetching stats: $e');
    }
  }

  Future<void> _fetchLogs() async {
    if (widget.currentUser?.idEmpresa == null) return;

    try {
      final packsResponse = await Supabase.instance.client
          .from('qrEmpresas')
          .select('idQrEmpresas')
          .eq('idEmpresa', widget.currentUser!.idEmpresa!);

      final packs = packsResponse as List<dynamic>;
      if (packs.isEmpty) {
        if (mounted) setState(() => _logs = []);
        return;
      }

      final packIds = packs.map((p) => p['idQrEmpresas']).toList();

      final response = await Supabase.instance.client
          .from('qrGenerados')
          .select(
            'idQR, claveAcceso, fechaValidez, tipoQR, fc, datosVisitantes(nomVisitante)',
          )
          .inFilter('idQrEmpresas', packIds)
          .order('fc', ascending: false)
          .limit(20);

      final List<LogItem> mappedLogs =
          (response as List<dynamic>).map((item) {
            String visitorName = 'Desconocido';
            final dv = item['datosVisitantes'];
            if (dv != null) {
              if (dv is List && dv.isNotEmpty) {
                visitorName = dv[0]['nomVisitante'] ?? 'Desconocido';
              } else if (dv is Map) {
                visitorName = dv['nomVisitante'] ?? 'Desconocido';
              }
            }

            return LogItem(
              idQR: item['idQR'],
              claveAcceso: item['claveAcceso'],
              visitorName: visitorName,
              fechaValidez: item['fechaValidez'],
              tipoQR: item['tipoQR'],
              fc: item['fc'],
            );
          }).toList();

      if (mounted) {
        setState(() {
          _logs = mappedLogs;
        });
      }
    } catch (e) {
      debugPrint('Error fetching logs: $e');
    }
  }

  Future<void> _shareQR(LogItem log) async {
    final validUntil = DateTime.parse(log.fechaValidez);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    if (validUntil.isBefore(today)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No se pueden compartir códigos expirados'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    setState(() => _isSharing = true);
    try {
      final controller = ScreenshotController();
      final bytes = await controller.captureFromWidget(
        Material(
          color: Colors.white,
          child: Container(
            width: 350,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      LucideIcons.scanLine,
                      color: const Color(Constants.colorPrimary),
                      size: 32,
                    ),
                    const SizedBox(width: 12),
                    Text(
                      'Acceso SPH',
                      style: TextStyle(
                        color: const Color(Constants.colorPrimary),
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                QrImageView(
                  data: log.claveAcceso,
                  version: QrVersions.auto,
                  size: 250.0,
                  backgroundColor: Colors.white,
                  gapless: true,
                ),
                const SizedBox(height: 24),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(
                        TextSpan(
                          text: 'Visitante: ',
                          style: const TextStyle(
                            color: Colors.grey,
                            fontSize: 16,
                          ),
                          children: [
                            TextSpan(
                              text: log.visitorName,
                              style: const TextStyle(
                                color: Colors.black,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text.rich(
                        TextSpan(
                          text: 'Tipo: ',
                          style: const TextStyle(
                            color: Colors.grey,
                            fontSize: 16,
                          ),
                          children: [
                            TextSpan(
                              text: log.tipoQR,
                              style: const TextStyle(
                                color: Colors.black,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text.rich(
                        TextSpan(
                          text: 'Fecha: ',
                          style: const TextStyle(
                            color: Colors.grey,
                            fontSize: 16,
                          ),
                          children: [
                            TextSpan(
                              text: DateFormat(
                                'yyyy-MM-dd',
                              ).format(DateTime.parse(log.fechaValidez)),
                              style: const TextStyle(
                                color: Colors.black,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Clave: ${log.claveAcceso}',
                        style: const TextStyle(
                          color: Colors.grey,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        delay: const Duration(milliseconds: 100),
        pixelRatio: 2.0,
      );

      final tempDir = await getTemporaryDirectory();
      final file =
          await File('${tempDir.path}/access-${log.claveAcceso}.png').create();
      await file.writeAsBytes(bytes);

      await Share.shareXFiles(
        [XFile(file.path)],
        text: 'Acceso SPH: ${log.visitorName}',
        sharePositionOrigin: const Rect.fromLTWH(0, 0, 1, 1),
      );
    } catch (e) {
      debugPrint('Error sharing: $e');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Error al compartir QR')));
      }
    } finally {
      if (mounted) setState(() => _isSharing = false);
    }
  }

  void _showQRDialog(LogItem log) {
    final validUntil = DateTime.parse(log.fechaValidez);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final isExpired = validUntil.isBefore(today);

    if (isExpired) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Este código QR ya está vencido'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    showDialog(
      context: context,
      builder:
          (context) => Dialog(
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Código de Acceso',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(16),
                      color: Colors.white,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          QrImageView(
                            data: log.claveAcceso,
                            version: QrVersions.auto,
                            size: 200.0,
                            backgroundColor: Colors.white,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            log.claveAcceso,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                              letterSpacing: 2,
                            ),
                          ),
                          Text(
                            log.visitorName,
                            style: const TextStyle(color: Colors.grey),
                          ),
                          Text(
                            'Vence: ${DateFormat('dd/MM/yyyy').format(DateTime.parse(log.fechaValidez))}',
                            style: const TextStyle(
                              color: Colors.red,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed:
                            (_isSharing || isExpired)
                                ? null
                                : () => _shareQR(log),
                        icon: const Icon(LucideIcons.share2),
                        label: const Text('Compartir'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor:
                              isExpired
                                  ? Colors.grey
                                  : const Color(Constants.colorPrimary),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _logs.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    final usagePercent = _limit > 0 ? (_usage / _limit) : 0.0;
    final isLimitReached = _usage >= _limit;

    return RefreshIndicator(
      onRefresh: _fetchData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Stats Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(
                      LucideIcons.barChart2,
                      color: Color(Constants.colorPrimary),
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Uso Diario (General)',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Color(Constants.colorPrimary),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '$_usage / $_limit',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color:
                            isLimitReached
                                ? Colors.red
                                : const Color(Constants.colorPrimary),
                      ),
                    ),
                    Text(
                      '${(usagePercent * 100).toStringAsFixed(1)}%',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: isLimitReached ? Colors.red : Colors.grey,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: usagePercent > 1 ? 1 : usagePercent,
                  backgroundColor: Colors.grey.shade100,
                  color:
                      isLimitReached
                          ? Colors.red
                          : const Color(Constants.colorPrimary),
                  minHeight: 8,
                  borderRadius: BorderRadius.circular(4),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Recent Logs
          const Text(
            'Últimos QR Generados',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(Constants.colorText),
            ),
          ),
          const SizedBox(height: 12),

          if (_logs.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(32.0),
                child: Text('No hay registros recientes'),
              ),
            )
          else
            ..._logs.map((log) {
              final created = DateTime.parse(log.fc);
              final validUntil = DateTime.parse(log.fechaValidez);
              final now = DateTime.now();
              final today = DateTime(now.year, now.month, now.day);
              final isExpired = validUntil.isBefore(today);

              return Card(
                elevation: 0,
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.grey.shade200),
                ),
                color: Colors.white,
                child: InkWell(
                  onTap: () {
                    if (isExpired) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Este código QR ya está vencido'),
                          backgroundColor: Colors.red,
                        ),
                      );
                    } else {
                      _showQRDialog(log);
                    }
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(Constants.colorLight),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            LucideIcons.qrCode,
                            color: Color(Constants.colorPrimary),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                log.visitorName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color:
                                          log.tipoQR == 'Uso General'
                                              ? Colors.blue.shade50
                                              : Colors.purple.shade50,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      log.tipoQR,
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color:
                                            log.tipoQR == 'Uso General'
                                                ? Colors.blue.shade700
                                                : Colors.purple.shade700,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Icon(
                                    isExpired
                                        ? LucideIcons.alertCircle
                                        : LucideIcons.checkCircle,
                                    size: 14,
                                    color:
                                        isExpired ? Colors.red : Colors.green,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    DateFormat('dd/MM HH:mm').format(created),
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade500,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const Icon(
                          LucideIcons.chevronRight,
                          color: Colors.grey,
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),

          // Bottom padding for FAB if needed
          const SizedBox(height: 80),
        ],
      ),
    );
  }
}
