import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sph_control_accesos/constants.dart';
import 'package:sph_control_accesos/models/db.dart';

class ProfilePage extends StatelessWidget {
  final CatUser? currentUser;
  final String? companyName;
  final String? profileName;
  final Future<void> Function()? onRefresh;

  const ProfilePage({
    super.key,
    this.currentUser,
    this.companyName,
    this.profileName,
    this.onRefresh,
  });

  Future<void> _logout() async {
    await Supabase.instance.client.auth.signOut();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh ?? () async {},
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
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
                const Text(
                  'Perfil de Usuario',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Color(Constants.colorPrimary),
                  ),
                ),
                const SizedBox(height: 24),
                _buildProfileItem(
                  'Nombre',
                  '${currentUser?.nombre} ${currentUser?.apellidos}',
                ),
                const SizedBox(height: 16),
                _buildProfileItem(
                  'Email',
                  Supabase.instance.client.auth.currentUser?.email ??
                      'No disponible',
                ),
                const SizedBox(height: 16),
                _buildProfileItem('Empresa', companyName ?? 'No asignada'),
                const SizedBox(height: 16),
                _buildProfileItem('Rol', profileName ?? 'Sin rol'),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _logout,
                    icon: const Icon(LucideIcons.logOut),
                    label: const Text('Cerrar Sesión'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.shade50,
                      foregroundColor: Colors.red,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }

  Widget _buildProfileItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 14, color: Colors.grey[600])),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }
}
