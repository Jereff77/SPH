import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:screenshot/screenshot.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:gal/gal.dart';
import 'package:sph_control_accesos/constants.dart';
import 'package:sph_control_accesos/models/db.dart';

class GenerateQRPage extends StatefulWidget {
  final CatUser? currentUser;

  const GenerateQRPage({super.key, this.currentUser});

  @override
  State<GenerateQRPage> createState() => _GenerateQRPageState();
}

class _GenerateQRPageState extends State<GenerateQRPage> {
  // Data State
  List<QrEmpresa> _qrTypes = [];
  List<String> _uniqueQrTypes = [];
  List<DatosVisitante> _visitors = [];
  bool _loading = false;

  // Limits State
  int _companyDailyLimit = 0;
  int _companyDailyUsage = 0;

  // Form State
  String? _selectedQrType;
  String? _selectedVisitorId;
  DateTime _visitDate = DateTime.now();
  bool _isNewVisitor = false;

  // New Visitor Form State
  final _newVisitorFormKey = GlobalKey<FormState>();
  final _newVisitorNameController = TextEditingController();
  final _newVisitorPhoneController = TextEditingController();
  String? _newVisitorVehicleType;
  final _newVisitorPlateController = TextEditingController();
  XFile? _newVisitorIdImage;

  // Generated QR State
  Map<String, dynamic>? _generatedQR;
  final ScreenshotController _screenshotController = ScreenshotController();
  bool _isSharing = false;
  bool _isDownloading = false;

  @override
  void initState() {
    super.initState();
    if (widget.currentUser != null) {
      _loadData();
    }
  }

  @override
  void didUpdateWidget(GenerateQRPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentUser != widget.currentUser &&
        widget.currentUser != null) {
      _loadData();
    }
  }

  @override
  void dispose() {
    _newVisitorNameController.dispose();
    _newVisitorPhoneController.dispose();
    _newVisitorPlateController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    await Future.wait([
      _fetchQrTypes(),
      _fetchVisitors(),
      _fetchCompanyUsage(),
      _fetchCompanyLimit(),
    ]);
    if (mounted) {
      setState(() => _loading = false);
    }
  }

  Future<void> _fetchCompanyLimit() async {
    if (widget.currentUser?.idEmpresa == null) return;
    try {
      final response =
          await Supabase.instance.client
              .from('empresas')
              .select('qrDiarios')
              .eq('idEmpresa', widget.currentUser!.idEmpresa!)
              .maybeSingle();
      if (mounted && response != null) {
        setState(() {
          _companyDailyLimit = (response['qrDiarios'] as int?) ?? 0;
        });
      }
    } catch (e) {
      debugPrint('Error fetching company limit: $e');
    }
  }

  Future<void> _fetchQrTypes() async {
    if (widget.currentUser?.idEmpresa == null) {
      if (mounted) setState(() => _qrTypes = []);
      return;
    }
    try {
      final response = await Supabase.instance.client
          .from('qrEmpresas')
          .select()
          .eq('idEmpresa', widget.currentUser!.idEmpresa!);

      final packs =
          (response as List<dynamic>)
              .map((e) => QrEmpresa.fromJson(e))
              .toList();

      if (mounted) {
        setState(() {
          _qrTypes = packs;
          _updateUniqueQrTypes(packs);
        });
      }
    } catch (e) {
      debugPrint('Error fetching QR types: $e');
    }
  }

  void _updateUniqueQrTypes(List<QrEmpresa> packs) {
    final types = <String>{};
    final hasValidPacks = packs.any((q) => q.vigente == true);

    if (hasValidPacks) {
      types.add('Uso General');
      for (var q in packs) {
        if (q.vigente == true && q.tipoQR == 'Administrativo') {
          types.add('Administrativo');
        }
      }
    }
    setState(() {
      _uniqueQrTypes = types.toList();
    });
  }

  Future<void> _fetchVisitors() async {
    if (widget.currentUser?.idEmpresa == null) {
      if (mounted) setState(() => _visitors = []);
      return;
    }
    try {
      final response = await Supabase.instance.client
          .from('datosVisitantes')
          .select()
          .eq('idEmpresa', widget.currentUser!.idEmpresa!)
          .order('nomVisitante', ascending: true);

      final visitors =
          (response as List<dynamic>)
              .map((e) => DatosVisitante.fromJson(e))
              .toList();

      if (mounted) {
        setState(() => _visitors = visitors);
      }
    } catch (e) {
      debugPrint('Error fetching visitors: $e');
    }
  }

  Future<void> _fetchCompanyUsage() async {
    if (widget.currentUser?.idEmpresa == null) return;

    try {
      final packsResponse = await Supabase.instance.client
          .from('qrEmpresas')
          .select('idQrEmpresas')
          .eq('idEmpresa', widget.currentUser!.idEmpresa!);

      final packs = packsResponse as List<dynamic>;
      if (packs.isEmpty) {
        if (mounted) setState(() => _companyDailyUsage = 0);
        return;
      }

      final packIds = packs.map((p) => p['idQrEmpresas']).toList();
      final today = DateTime.now().toIso8601String().split('T')[0];

      int totalCount = 0;
      const chunkSize = 10;

      for (var i = 0; i < packIds.length; i += chunkSize) {
        final end =
            (i + chunkSize < packIds.length) ? i + chunkSize : packIds.length;
        final chunk = packIds.sublist(i, end);

        final count = await Supabase.instance.client
            .from('qrGenerados')
            .count(CountOption.exact)
            .inFilter('idQrEmpresas', chunk)
            .eq('tipoQR', 'Uso General')
            .gte('fc', '${today}T00:00:00')
            .lte('fc', '${today}T23:59:59');

        totalCount += count;
      }

      if (mounted) {
        setState(() => _companyDailyUsage = totalCount);
      }
    } catch (e) {
      debugPrint('Error fetching usage: $e');
    }
  }

  String _formatPhoneNumber(String value) {
    final numbers = value.replaceAll(RegExp(r'\D'), '');
    if (numbers.isEmpty) return '';
    if (numbers.length <= 3) return '($numbers';
    if (numbers.length <= 6) {
      return '(${numbers.substring(0, 3)}) ${numbers.substring(3)}';
    }
    return '(${numbers.substring(0, 3)}) ${numbers.substring(3, 6)}-${numbers.substring(6, min(10, numbers.length))}';
  }

  Future<String?> _handleCreateVisitor() async {
    if (widget.currentUser?.idEmpresa == null ||
        widget.currentUser?.uid == null) {
      return null;
    }

    String? idImageUrl;

    if (_newVisitorIdImage != null) {
      try {
        final fileExt = _newVisitorIdImage!.name.split('.').last;
        final fileName = '${Random().nextInt(1000000)}.$fileExt';
        final filePath = '${widget.currentUser!.idEmpresa}/$fileName';

        final fileBytes = await _newVisitorIdImage!.readAsBytes();

        await Supabase.instance.client.storage
            .from('identificaciones')
            .uploadBinary(filePath, fileBytes);

        idImageUrl = Supabase.instance.client.storage
            .from('identificaciones')
            .getPublicUrl(filePath);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error subiendo identificación: $e')),
          );
        }
        return null;
      }
    }

    final newVisitor = {
      'nomVisitante': _newVisitorNameController.text,
      'telefonoVisitante': _newVisitorPhoneController.text,
      'tipoVehiculo': _newVisitorVehicleType,
      'placasVehiculo': _newVisitorPlateController.text,
      'urlIdentificacion': idImageUrl,
      'idEmpresa': widget.currentUser!.idEmpresa,
      'uidr': widget.currentUser!.uid,
      'status': true,
    };

    try {
      final response =
          await Supabase.instance.client
              .from('datosVisitantes')
              .insert(newVisitor)
              .select()
              .single();

      final createdVisitor = DatosVisitante.fromJson(response);

      if (mounted) {
        setState(() {
          _visitors.add(createdVisitor);
          _visitors.sort(
            (a, b) => (a.nomVisitante ?? '').compareTo(b.nomVisitante ?? ''),
          );
          _isNewVisitor = false;
          _selectedVisitorId = createdVisitor.idVisitante;
          _newVisitorNameController.clear();
          _newVisitorPhoneController.clear();
          _newVisitorPlateController.clear();
          _newVisitorVehicleType = null;
          _newVisitorIdImage = null;
        });
      }
      return createdVisitor.idVisitante;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error creando visitante: $e')));
      }
      return null;
    }
  }

  String _generateAccessKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    final rnd = Random();
    return String.fromCharCodes(
      Iterable.generate(15, (_) => chars.codeUnitAt(rnd.nextInt(chars.length))),
    );
  }

  Future<void> _handleGenerateQR() async {
    if (_selectedQrType == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor selecciona tipo de QR')),
      );
      return;
    }

    String? visitorId = _selectedVisitorId;

    // Perfil 3.2 logic based on 'nivel' field
    final isProfile32 = widget.currentUser?.nivel == 3.2;

    if (_isNewVisitor) {
      if (!_newVisitorFormKey.currentState!.validate()) {
        return;
      }
      if (!isProfile32 && _newVisitorIdImage == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('La identificación del visitante es obligatoria'),
          ),
        );
        return;
      }
      visitorId = await _handleCreateVisitor();
      if (visitorId == null) return;
    } else if (visitorId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor selecciona un visitante')),
      );
      return;
    }

    setState(() => _loading = true);

    try {
      QrEmpresa? validPack;

      if (_selectedQrType == 'Administrativo') {
        try {
          validPack = _qrTypes.firstWhere((q) => q.tipoQR == 'Administrativo');
        } catch (_) {
          validPack = _qrTypes.isNotEmpty ? _qrTypes.first : null;
        }

        if (validPack == null) {
          throw Exception(
            'No se encontró configuración de QR para su empresa.',
          );
        }
      } else {
        final remaining = _companyDailyLimit - _companyDailyUsage;
        if (remaining <= 0) {
          throw Exception(
            'Has alcanzado el límite diario de QRs ($_companyDailyLimit). Intenta mañana.',
          );
        }

        try {
          validPack = _qrTypes.firstWhere(
            (q) => q.tipoQR == _selectedQrType && q.vigente == true,
          );
        } catch (_) {
          try {
            validPack = _qrTypes.firstWhere((q) => q.vigente == true);
          } catch (_) {
            throw Exception('No hay configuración vigente para generar QRs.');
          }
        }
      }

      final visitorObj = _visitors.firstWhere(
        (v) => v.idVisitante == visitorId,
      );
      final accessKey = _generateAccessKey();
      final dateStr = DateFormat('yyyy-MM-dd').format(_visitDate);

      final newQR = {
        'claveAcceso': accessKey,
        'idVisitante': visitorId,
        'idQrEmpresas': validPack.idQrEmpresas,
        'fechaValidez': dateStr,
        'tipoQR': _selectedQrType,
        'status': true,
        'vigencia': true,
        'uidr': widget.currentUser?.uid,
        'tipoVehiculo': visitorObj.tipoVehiculo,
        'placasVehiculo': visitorObj.placasVehiculo,
        'estado': 1,
        'limiteUsos': 3,
        'usos': 0,
        'fc': DateTime.now().toIso8601String(),
      };

      await Supabase.instance.client.from('qrGenerados').insert(newQR);

      await Future.wait([_fetchQrTypes(), _fetchCompanyUsage()]);

      setState(() {
        _generatedQR = {
          'code': accessKey,
          'type': _selectedQrType,
          'visitor': visitorObj.nomVisitante,
          'date': dateStr,
        };
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Error: ${e.toString().replaceAll("Exception: ", "")}',
            ),
          ),
        );
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _shareQR() async {
    if (_generatedQR == null) return;
    setState(() => _isSharing = true);

    try {
      final imageBytes = await _screenshotController.capture();

      if (imageBytes != null) {
        final tempDir = await getTemporaryDirectory();
        final file =
            await File(
              '${tempDir.path}/access-${_generatedQR!['code']}.png',
            ).create();
        await file.writeAsBytes(imageBytes);

        await Share.shareXFiles(
          [XFile(file.path)],
          text: 'Acceso SPH: ${_generatedQR!['visitor']}',
          sharePositionOrigin: const Rect.fromLTWH(0, 0, 1, 1),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error al compartir QR: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSharing = false);
    }
  }

  Future<void> _downloadQR() async {
    if (_generatedQR == null) return;
    setState(() => _isDownloading = true);
    try {
      final imageBytes = await _screenshotController.capture();
      if (imageBytes == null) {
        throw Exception('No se pudo capturar la imagen del QR');
      }
      final hasAccess = await Gal.hasAccess();
      if (!hasAccess) {
        await Gal.requestAccess();
      }
      await Gal.putImageBytes(imageBytes);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('QR guardado en la galería')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error al descargar QR: $e')));
      }
    } finally {
      if (mounted) setState(() => _isDownloading = false);
    }
  }

  Future<void> _pickImage() async {
    final ImagePicker picker = ImagePicker();
    final XFile? image = await picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() {
        _newVisitorIdImage = image;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_generatedQR != null) {
      final validUntil = DateTime.parse(_generatedQR!['date']);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final isExpired = validUntil.isBefore(today);

      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Screenshot(
                controller: _screenshotController,
                child: Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            LucideIcons.qrCode,
                            color: Color(Constants.colorPrimary),
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Acceso SPH',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Color(Constants.colorPrimary),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      QrImageView(
                        data: _generatedQR!['code'],
                        version: QrVersions.auto,
                        size: 200.0,
                        backgroundColor: Colors.white,
                      ),
                      const SizedBox(height: 16),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Visitante: ${_generatedQR!['visitor']}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text('Tipo: ${_generatedQR!['type']}'),
                            Text('Fecha: ${_generatedQR!['date']}'),
                            const SizedBox(height: 8),
                            Text(
                              'Clave: ${_generatedQR!['code']}',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: (_isSharing || isExpired) ? null : _shareQR,
                  icon: const Icon(LucideIcons.share2),
                  label: Text(_isSharing ? 'Generando...' : 'Compartir'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor:
                        isExpired
                            ? Colors.grey
                            : const Color(Constants.colorPrimary),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isDownloading ? null : _downloadQR,
                  icon: const Icon(LucideIcons.download),
                  label: Text(_isDownloading ? 'Guardando...' : 'Descargar'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(Constants.colorPrimary),
                    side: const BorderSide(
                      color: Color(Constants.colorPrimary),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => setState(() => _generatedQR = null),
                child: const Text(
                  'Generar Nuevo',
                  style: TextStyle(fontSize: 16),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // 1. Tipo de QR
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(
                      LucideIcons.qrCode,
                      size: 16,
                      color: Color(Constants.colorPrimary),
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Tipo de QR',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _selectedQrType,
                  isExpanded: true,
                  hint: Text(
                    _uniqueQrTypes.isEmpty
                        ? (widget.currentUser?.idEmpresa != null
                            ? 'Sin tipos de QR disponibles'
                            : 'Usuario sin empresa')
                        : 'Selecciona un tipo...',
                  ),
                  items:
                      _uniqueQrTypes.map((type) {
                        String availabilityText = '';
                        if (type == 'Administrativo') {
                          availabilityText = '(Ilimitado)';
                        } else if (type == 'Uso General') {
                          final remaining = max(
                            0,
                            _companyDailyLimit - _companyDailyUsage,
                          );
                          availabilityText = '($remaining disp. hoy)';
                        } else {
                          final available = _qrTypes
                              .where(
                                (q) => q.tipoQR == type && q.vigente == true,
                              )
                              .fold(
                                0,
                                (sum, item) => sum + (item.disponibles ?? 0),
                              );
                          availabilityText =
                              available > 0
                                  ? '($available en inventario)'
                                  : '(Sin saldo)';
                        }
                        return DropdownMenuItem(
                          value: type,
                          child: Text(
                            '$type $availabilityText',
                            style: const TextStyle(fontSize: 14),
                            overflow: TextOverflow.ellipsis,
                          ),
                        );
                      }).toList(),
                  onChanged:
                      _uniqueQrTypes.isEmpty
                          ? null
                          : (value) {
                            setState(() => _selectedQrType = value);
                          },
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 2. Visitante
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(
                          LucideIcons.search,
                          size: 16,
                          color: Color(Constants.colorPrimary),
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Visitante',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    TextButton.icon(
                      onPressed: () {
                        setState(() => _isNewVisitor = !_isNewVisitor);
                      },
                      icon: Icon(
                        _isNewVisitor ? Icons.close : Icons.add,
                        size: 16,
                      ),
                      label: Text(
                        _isNewVisitor ? 'Cancelar' : 'Nuevo Visitante',
                      ),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(Constants.colorPrimary),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                if (_isNewVisitor)
                  Form(
                    key: _newVisitorFormKey,
                    child: Column(
                      children: [
                        TextFormField(
                          controller: _newVisitorNameController,
                          decoration: const InputDecoration(
                            labelText: 'Nombre Completo',
                            border: OutlineInputBorder(),
                          ),
                          validator:
                              (v) => v?.isEmpty ?? true ? 'Requerido' : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _newVisitorPhoneController,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(
                            labelText: 'Teléfono',
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (val) {
                            final formatted = _formatPhoneNumber(val);
                            if (formatted != _newVisitorPhoneController.text) {
                              _newVisitorPhoneController
                                  .value = TextEditingValue(
                                text: formatted,
                                selection: TextSelection.collapsed(
                                  offset: formatted.length,
                                ),
                              );
                            }
                          },
                        ),
                        const SizedBox(height: 12),
                        if (widget.currentUser?.nivel != 3.2) ...[
                              Row(
                                children: [
                                  Expanded(
                                child: DropdownButtonFormField<String>(
                                  value: _newVisitorVehicleType,
                                  hint: const Text('Vehículo'),
                                  items:
                                      ['Ligero', 'Carga']
                                          .map(
                                            (t) => DropdownMenuItem(
                                              value: t,
                                              child: Text(t),
                                            ),
                                          )
                                          .toList(),
                                  onChanged:
                                      (v) => setState(
                                        () => _newVisitorVehicleType = v,
                                      ),
                                  decoration: const InputDecoration(
                                    border: OutlineInputBorder(),
                                    contentPadding: EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 8,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextFormField(
                                  controller: _newVisitorPlateController,
                                  decoration: const InputDecoration(
                                    labelText: 'Placas',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          InkWell(
                            onTap: _pickImage,
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                border: Border.all(color: Colors.grey),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.image, color: Colors.grey),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _newVisitorIdImage != null
                                          ? 'Imagen seleccionada'
                                          : 'Identificación (Requerida)',
                                      style: TextStyle(
                                        color:
                                            _newVisitorIdImage != null
                                                ? Colors.black
                                                : Colors.grey[700],
                                      ),
                                    ),
                                  ),
                                  if (_newVisitorIdImage != null)
                                    const Icon(
                                      Icons.check_circle,
                                      color: Colors.green,
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed:
                                _loading
                                    ? null
                                    : () async {
                                      if (!_newVisitorFormKey.currentState!
                                          .validate()) {
                                        return;
                                      }
                                      if (widget.currentUser?.nivel != 3.2 &&
                                          _newVisitorIdImage == null) {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
                                              const SnackBar(
                                                content: Text(
                                                  'La identificación del visitante es obligatoria',
                                                ),
                                                backgroundColor: Colors.red,
                                              ),
                                            );
                                        return;
                                      }

                                      setState(() => _loading = true);
                                      final result =
                                          await _handleCreateVisitor();
                                      if (mounted) {
                                        setState(() => _loading = false);
                                        if (result != null) {
                                          ScaffoldMessenger.of(context)
                                              .showSnackBar(
                                                const SnackBar(
                                                  content: Text(
                                                    'Visitante registrado con éxito',
                                                  ),
                                                  backgroundColor: Colors.green,
                                                ),
                                              );
                                        }
                                      }
                                    },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.black87,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            child:
                                _loading
                                    ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                    : const Text('Guardar Visitante'),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  DropdownButtonFormField<String>(
                    value: _selectedVisitorId,
                    isExpanded: true,
                    hint: const Text('Selecciona un visitante...'),
                    items:
                        _visitors.map((v) {
                          final label =
                              '${v.nomVisitante} ${v.placasVehiculo != null ? '(${v.placasVehiculo})' : ''}';
                          return DropdownMenuItem(
                            value: v.idVisitante,
                            child: Text(label, overflow: TextOverflow.ellipsis),
                          );
                        }).toList(),
                    onChanged: (value) {
                      setState(() => _selectedVisitorId = value);
                    },
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 3. Fecha
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(
                      LucideIcons.calendar,
                      size: 16,
                      color: Color(Constants.colorPrimary),
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Fecha de Visita',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _visitDate,
                      firstDate: DateTime.now().subtract(
                        const Duration(days: 1),
                      ),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null && picked != _visitDate) {
                      setState(() => _visitDate = picked);
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(DateFormat('dd/MM/yyyy').format(_visitDate)),
                        const Icon(Icons.calendar_today, size: 16),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 32),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _loading ? null : _handleGenerateQR,
              icon:
                  _loading
                      ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                      : const Icon(LucideIcons.qrCode),
              label: Text(_loading ? 'Generando...' : 'Generar QR de Acceso'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(Constants.colorPrimary),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                textStyle: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}
