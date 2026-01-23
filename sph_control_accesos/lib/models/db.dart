class CatUser {
  final String uid;
  final String? nombre;
  final String? apellidos;
  final String? idEmpresa;
  final String? email;
  final String? idPerfil;
  final double? nivel;

  CatUser({
    required this.uid,
    this.nombre,
    this.apellidos,
    this.idEmpresa,
    this.email,
    this.idPerfil,
    this.nivel,
  });

  factory CatUser.fromJson(Map<String, dynamic> json) {
    return CatUser(
      uid: json['uid'] as String,
      nombre: json['nombre'] as String?,
      apellidos: json['apellidos'] as String?,
      idEmpresa: json['idEmpresa'] as String?,
      email: json['email'] as String?,
      idPerfil: json['idPerfil'] as String?,
      nivel: (json['nivel'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'uid': uid,
      'nombre': nombre,
      'apellidos': apellidos,
      'idEmpresa': idEmpresa,
      'email': email,
      'idPerfil': idPerfil,
      'nivel': nivel,
    };
  }
}

class CatPerfil {
  final String idPerfil;
  final String nombre;

  CatPerfil({
    required this.idPerfil,
    required this.nombre,
  });

  factory CatPerfil.fromJson(Map<String, dynamic> json) {
    return CatPerfil(
      idPerfil: json['idPerfil'] as String,
      nombre: json['nombre'] as String,
    );
  }
}

class Empresa {
  final String idEmpresa;
  final String nombreEmpresa;
  final int? qrDiarios;
  final int? qrLigero;
  final int? qrCarga;

  Empresa({
    required this.idEmpresa,
    required this.nombreEmpresa,
    this.qrDiarios,
    this.qrLigero,
    this.qrCarga,
  });

  factory Empresa.fromJson(Map<String, dynamic> json) {
    return Empresa(
      idEmpresa: json['idEmpresa'] as String,
      nombreEmpresa: json['nombreEmpresa'] as String,
      qrDiarios: json['qrDiarios'] as int?,
      qrLigero: json['qrLigero'] as int?,
      qrCarga: json['qrCarga'] as int?,
    );
  }
}

class QrEmpresa {
  final String idQrEmpresas;
  final String? tipoQR;
  final String? idEmpresa;
  final int? disponibles;
  final bool? vigente;

  QrEmpresa({
    required this.idQrEmpresas,
    this.tipoQR,
    this.idEmpresa,
    this.disponibles,
    this.vigente,
  });

  factory QrEmpresa.fromJson(Map<String, dynamic> json) {
    return QrEmpresa(
      idQrEmpresas: json['idQrEmpresas'] as String,
      tipoQR: json['tipoQR'] as String?,
      idEmpresa: json['idEmpresa'] as String?,
      disponibles: json['disponibles'] as int?,
      vigente: json['vigente'] as bool?,
    );
  }
}

class DatosVisitante {
  final String idVisitante;
  final String? nomVisitante;
  final String? telefonoVisitante;
  final String? tipoVehiculo;
  final String? placasVehiculo;
  final String idEmpresa;
  final String uidr;
  final String? urlIdentificacion;

  DatosVisitante({
    required this.idVisitante,
    this.nomVisitante,
    this.telefonoVisitante,
    this.tipoVehiculo,
    this.placasVehiculo,
    required this.idEmpresa,
    required this.uidr,
    this.urlIdentificacion,
  });

  factory DatosVisitante.fromJson(Map<String, dynamic> json) {
    return DatosVisitante(
      idVisitante: json['idVisitante'] as String,
      nomVisitante: json['nomVisitante'] as String?,
      telefonoVisitante: json['telefonoVisitante'] as String?,
      tipoVehiculo: json['tipoVehiculo'] as String?,
      placasVehiculo: json['placasVehiculo'] as String?,
      idEmpresa: json['idEmpresa'] as String,
      uidr: json['uidr'] as String,
      urlIdentificacion: json['urlIdentificacion'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'idVisitante': idVisitante,
      'nomVisitante': nomVisitante,
      'telefonoVisitante': telefonoVisitante,
      'tipoVehiculo': tipoVehiculo,
      'placasVehiculo': placasVehiculo,
      'idEmpresa': idEmpresa,
      'uidr': uidr,
      'urlIdentificacion': urlIdentificacion,
    };
  }
}

class QrGenerado {
  final String idQR;
  final String claveAcceso;
  final String? idVisitante;
  final String? idQrEmpresas;
  final String? fechaValidez;
  final String? tipoQR;
  final bool status;
  final bool vigencia;
  final String? tipoVehiculo;
  final String? placasVehiculo;
  final int? estado;
  final int? limiteUsos;
  final int? usos;
  final String fc;

  QrGenerado({
    required this.idQR,
    required this.claveAcceso,
    this.idVisitante,
    this.idQrEmpresas,
    this.fechaValidez,
    this.tipoQR,
    required this.status,
    required this.vigencia,
    this.tipoVehiculo,
    this.placasVehiculo,
    this.estado,
    this.limiteUsos,
    this.usos,
    required this.fc,
  });

  factory QrGenerado.fromJson(Map<String, dynamic> json) {
    return QrGenerado(
      idQR: json['idQR'] as String,
      claveAcceso: json['claveAcceso'] as String,
      idVisitante: json['idVisitante'] as String?,
      idQrEmpresas: json['idQrEmpresas'] as String?,
      fechaValidez: json['fechaValidez'] as String?,
      tipoQR: json['tipoQR'] as String?,
      status: json['status'] as bool? ?? false,
      vigencia: json['vigencia'] as bool? ?? false,
      tipoVehiculo: json['tipoVehiculo'] as String?,
      placasVehiculo: json['placasVehiculo'] as String?,
      estado: json['estado'] as int?,
      limiteUsos: json['limiteUsos'] as int?,
      usos: json['usos'] as int?,
      fc: json['fc'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'idQR': idQR,
      'claveAcceso': claveAcceso,
      'idVisitante': idVisitante,
      'idQrEmpresas': idQrEmpresas,
      'fechaValidez': fechaValidez,
      'tipoQR': tipoQR,
      'status': status,
      'vigencia': vigencia,
      'tipoVehiculo': tipoVehiculo,
      'placasVehiculo': placasVehiculo,
      'estado': estado,
      'limiteUsos': limiteUsos,
      'usos': usos,
      'fc': fc,
    };
  }
}
