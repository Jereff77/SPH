import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sph_control_accesos/constants.dart';
import 'package:sph_control_accesos/pages/login_page.dart';
import 'package:sph_control_accesos/widgets/main_scaffold.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: Constants.supabaseUrl,
    anonKey: Constants.supabaseAnonKey,
  );

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SPH Control de Accesos',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(Constants.colorPrimary),
          primary: const Color(Constants.colorPrimary),
          surface: const Color(Constants.colorLight),
        ),
        textTheme: GoogleFonts.interTextTheme(
          Theme.of(context).textTheme,
        ),
        useMaterial3: true,
      ),
      home: const AuthGate(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: Supabase.instance.client.auth.onAuthStateChange,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final session = snapshot.data?.session;

        if (session != null) {
          return const MainScaffold();
        } else {
          return const LoginPage();
        }
      },
    );
  }
}
