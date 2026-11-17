# Vehicle dynamics overhaul

This replaces the first release's vehicle controller while preserving the existing Three.js park, workshop, build saves, map, progression, photo export and static Cloudflare deployment.

## What was physically wrong

The old `Simulation` created only a compound chassis body and Rapier's dynamic raycast vehicle controller. Four independent rays supplied suspension forces; the visible axle housings and link rods did not constrain anything. Wheels could therefore support a car above a ledge without their actual sidewalls or axles colliding with it. A single steering angle was assigned to both front wheels. There were no steering knuckles, torque-limited servo demands or Ackermann geometry. Motor “torque” was actually a direct wheel-controller force with a speed taper: no battery voltage, motor current, back EMF, spinning wheel inertia or differential coupling. Surface grip came from the chassis position and used comparatively large multipliers. Rendering copied the latest pose without interpolation, and the render loop discarded elapsed time beyond 60 ms per frame.

## Physical assembly

The new assembly has **17 dynamic rigid bodies and 26 joints**: one compound chassis, two axle housings, two front steering knuckles, four spinning wheels and eight suspension links. The original mesh vehicle is retained.

- Each front knuckle rotates on a limited Y-axis revolute joint. Each wheel spins on an X-axis revolute joint. Front hinge commands follow a rate-limited transmitter and Ackermann geometry; the inner wheel has the larger target angle. Rapier's implicit force-based servo acts between axle and knuckle. No steering code writes chassis orientation or forward velocity.
- Two actual solid axle bodies carry collision shapes for the tubes and differential housings. Four rigid links per axle connect spherical joints at both ends. Upper links are triangulated to locate the axle laterally. The closed link loops constrain axle translation, pitch and roll.
- Four shock forces act in equal/opposite pairs at the actual chassis and axle mounting points. They include compression/rebound damping, preload, compression bump stops and droop-limiting rope joints. Visual rods, spring lengths and axle transforms follow the physical assembly.
- The base assembly is approximately **3.16 kg**. Chassis, body, motor, ESC, battery, wheels, axles and links have separate mass contributions. Collider-derived inertia is used. Battery position, height, voltage/capacity-related pack mass and wheel weights change the actual centre of mass and inertia. There is no upright or anti-roll assistance torque.
- Vehicle/terrain collision layers disable self-collision between closely mounted mechanical parts. Wheels, axles and chassis still collide with terrain; link bodies carry mass but do not collide. Wheel cylinders use continuous collision detection and a small contact skin. Rendered terrain/bridge/rock collision sources are preserved.

## Motor, ESC and drivetrain

The model uses an approximate DC equivalent circuit, including `Kt = 60 / (2π KV)`, back EMF, winding resistance, bounded current, battery voltage/sag, electrical consumption and gear efficiency. Brushed winding turns map to a modeled KV; sensored brushless uses a separate KV and resistance. These are coherent simulation parameters, not calibration data from Traxxas or Axial.

Transmission, axle and optional portal reduction convert motor speed to wheel torque. Driving, braking and rolling resistance apply angular impulses to physical wheels, with reaction torque at the modeled gearbox/chassis. The visual driveshaft phases use actual driven wheel speeds and axle gearing. Open differentials split torque equally; locked mode adds sequential bilateral angular coupling impulses between wheel speeds. That coupling is an approximate projected driveline constraint, not a full rigid gear train or an exact Rapier gear-joint solution. Slip/scrub remains possible at the tyre contacts.

Keyboard inputs ramp progressively. Throttle and steering exponential response, sensitivity, endpoints, servo rate, servo torque demand, drag brake and precision crawling are adjustable. Existing gamepad steering/trigger support is retained. Key bindings are saved per device. Reverse motor input naturally opposes forward rotation before it accelerates backwards.

## Tyres and surfaces

Every wheel has a real cylindrical collider, angular inertia, physical contact manifolds and finite Coulomb friction solved by Rapier. Per-wheel coefficients combine contact surface, compound and a modest normal-load sensitivity. Dry granite, wet rock, timber, forest loam, gravel, mud and test concrete have separate coefficients/rolling resistance. Slip ratio and lateral contact velocity are measured from physical wheel rotation and contact-point velocity; they are displayed in diagnostics.

**Compliance is a reduced model, not a full soft-body tyre.** Normal contact impulses estimate load; radial deflection follows `load / foam stiffness`, is filtered and bounded to 6 mm, and reduces the actual collision radius. A world-space rubber/tread shader flattens the loaded contact and adds a small sidewall bulge. Rims and hubs remain rigid. This works on both normal and shadow rendering paths, but it does not solve a finite-element carcass, individual tread contact, distributed brush forces or a multi-point soft contact patch. Mud/gravel alter friction and rolling loss; the soil is not displaced.

The steering servo limits its elastic position demand according to available torque; damping is handled by Rapier's implicit joint motor. Its transient damping torque is not an exact hard electronic current limit. Steering under load and high-ratio differential behavior still require calibration against a physical crawler.

## Time, visuals and cameras

Physics runs at **240 Hz**, with 32 solver iterations, two internal PGS iterations and additional body-level iterations for the constrained assembly. Chassis, carriers, axle and wheel poses are interpolated between fixed snapshots. The fixed clock processes equivalent elapsed time at 30/60/120 render FPS; a >250 ms stall has explicitly tracked dropped time rather than unbounded catch-up. Hidden-tab time is suspended.

The original cameras remain, with suspension and cinematic views added. Chase offset follows yaw instead of every chassis roll fluctuation. Third-person camera rays check static collision geometry and keep distance from obstacles. Orbit inspection remains available for mouse/trackpad input. Photo mode continues to freeze the simulation and export PNGs. Manual recovery samples static support across the wheel footprint so the reassembled vehicle starts above a rock rather than inside it.

## Proving ground and diagnostics

The map now exposes a physical testing pad with marked turning circles, a single-wheel articulation wedge, a 20° ascent, a sidehill, small measured rocks and four surface lanes. F2 shows live mass/COM, wheel contacts/load/RPM, actual steering angles, slip, radial deflection, shock lengths, motor current/torque/RPM, gear ratio, pitch/roll, physical step time and dropped render time. It also displays Rapier collision wireframes. Physics diagnostics are optional and can be expensive on software WebGL.

## Remaining work

The constrained four-link R1 is implemented; alternate three-link/Panhard chassis configurations are not. Tyre compliance, servo current limiting and differential coupling remain reduced models. Batteries use a simplified voltage/charge model, not electrochemical cell dynamics. Wheel collision cylinders do not collide using every modeled tread block. No measured motor/tyre/servo data or physical RC telemetry has been used to calibrate handling. Small residual settling/creep and constraint deflection remain possible; further solver/geometry calibration and sustained trail testing are warranted. Water buoyancy, soil deformation, full drivetrain gear meshes and motor thermal behavior are outside this change.

Linux Chromium and numerical fixtures verify behavior; this is not a claim of physical TRX-4/SCX10 equivalence, validated Mac/Windows controller hardware or 60 FPS on every GPU. Consult `VALIDATION.md` for actual results.
