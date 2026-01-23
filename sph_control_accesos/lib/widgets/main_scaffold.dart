import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sph_control_accesos/constants.dart';
import 'package:sph_control_accesos/models/db.dart';
import 'package:sph_control_accesos/pages/dashboard_page.dart';
import 'package:sph_control_accesos/pages/generate_qr_page.dart';
import 'package:sph_control_accesos/pages/profile_page.dart';

class MainScaffold extends StatefulWidget {
  const MainScaffold({super.key});

  @override
  State<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends State<MainScaffold> {
  int _currentIndex = 0;
  CatUser? _currentUser;
  String? _companyName;
  String? _profileName;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchUserData();
  }

  Future<void> _fetchUserData() async {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null) return;

    try {
      final userResponse =
          await Supabase.instance.client
              .from('catUsers')
              .select()
              .eq('uid', userId)
              .single();

      final user = CatUser.fromJson(userResponse);

      String? company;
      String? profile;

      if (user.idEmpresa != null) {
        final companyResponse =
            await Supabase.instance.client
                .from('empresas')
                .select('nombreEmpresa')
                .eq('idEmpresa', user.idEmpresa!)
                .maybeSingle();

        if (companyResponse != null) {
          company = companyResponse['nombreEmpresa'] as String?;
        }
      }

      if (user.idPerfil != null) {
        final profileResponse =
            await Supabase.instance.client
                .from('catPerfiles')
                .select('nombre')
                .eq('idPerfil', user.idPerfil!)
                .maybeSingle();

        if (profileResponse != null) {
          profile = profileResponse['nombre'] as String?;
        }
      }

      if (mounted) {
        setState(() {
          _currentUser = user;
          _companyName = company;
          _profileName = profile;
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching user data: $e');
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _logout() async {
    await Supabase.instance.client.auth.signOut();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      backgroundColor: const Color(Constants.colorLight),
      appBar: AppBar(
        backgroundColor: const Color(Constants.colorPrimary),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(LucideIcons.qrCode, color: Colors.white, size: 20),
                SizedBox(width: 8),
                Flexible(
                  child: Text(
                    'SPH Control de Accesos',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            if (_currentUser != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${_currentUser!.nombre} ${_currentUser!.apellidos}',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (_companyName != null)
                      Text(
                        _companyName!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.logOut, color: Colors.white70),
            onPressed: _logout,
          ),
        ],
        toolbarHeight: _currentUser != null ? 72 : kToolbarHeight,
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          DashboardPage(currentUser: _currentUser),
          GenerateQrPage(currentUser: _currentUser),
          ProfilePage(
            currentUser: _currentUser,
            companyName: _companyName,
            profileName: _profileName,
            onRefresh: _fetchUserData,
          ),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 4,
              offset: const Offset(0, -1),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            setState(() {
              _currentIndex = index;
            });
            if (index == 2) {
              _fetchUserData();
            }
          },
          backgroundColor: Colors.white,
          selectedItemColor: const Color(Constants.colorPrimary),
          unselectedItemColor: Colors.grey,
          showUnselectedLabels: true,
          type: BottomNavigationBarType.fixed,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(LucideIcons.layoutDashboard),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(LucideIcons.qrCode),
              label: 'Generar QR',
            ),
            BottomNavigationBarItem(
              icon: Icon(LucideIcons.user),
              label: 'Perfil',
            ),
          ],
        ),
      ),
    );
  }
}
